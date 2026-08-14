"""Versioned decision policy.

Every rule that decides whether the assistant answers, refuses, or hands off to a
human lives here — not scattered across the router, the guard and the cache. The
point is auditability: a logged decision is only meaningful if you can still tell,
months later, which rules were in force when it was made.

Two identifiers are stamped onto every metrics event:

  policy_version    — fingerprint of the *whole* decision policy
  escalation_policy — fingerprint of just the escalation/refusal rules

They are separate on purpose. Retuning the cache similarity threshold changes
`policy_version` but leaves `escalation_policy` untouched, so historical
escalations are not churned by an unrelated change.

Each identifier is `<semver>+<fingerprint>`:

  - the semver half is bumped by hand when rules change meaningfully
  - the fingerprint half is a hash of the *effective runtime values*, including
    env-var overrides

The fingerprint exists because the hand-maintained half is not trustworthy on its
own. Change `GUARD_GROUNDING_THRESHOLD` in a deployment env and forget to bump
POLICY_VERSION, and the fingerprint moves anyway — the records stay correctly
attributed and the drift is visible instead of silent.

Resolving an old identifier requires knowing what it stood for, so every distinct
policy observed at runtime is appended to `data/policy_versions.json`. That file
is append-only: existing snapshots are never rewritten, only their `last_seen` is
advanced.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from pathlib import Path
from typing import Optional

# Bump by hand when the rules change in a way a reviewer should notice. The
# fingerprint catches everything else, including changes you forget to record.
POLICY_VERSION = "2026.08-1"
ESCALATION_POLICY_VERSION = "2026.08-1"


# --- rule data ----------------------------------------------------------------
# Owned here rather than in query_router so the fingerprint is computed over the
# exact lists the router uses. A fingerprint over a copy of the rules would be
# decorative.

SMALLTALK_PATTERNS = [
    "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
    "how are you", "thanks", "thank you", "bye", "goodbye",
]

ESCALATION_KEYWORDS = [
    "fraud", "stolen", "unauthorized", "scam", "phishing", "dispute",
    "complaint", "chargeback", "hack", "compromised",
]

# Deterministic banking vocabulary. A whole-word match here routes straight to
# the KB — terse, audit-friendly, and immune to the embedding-similarity overlap
# that makes short banking questions ("For NRI applicants?") look off-topic.
BANKING_KEYWORDS = [
    # products
    "account", "loan", "loans", "credit card", "debit card", "card", "savings",
    "deposit", "fixed deposit", "fd", "recurring deposit", "overdraft",
    "home loan", "personal loan", "car loan", "auto loan", "education loan",
    "business loan", "gold loan", "mortgage", "top-up loan", "balance transfer",
    # parties / eligibility
    "nri", "applicant", "applicants", "borrower", "co-applicant", "co-borrower",
    "eligibility", "eligible", "salaried", "self-employed", "nominee",
    # money mechanics
    "interest", "interest rate", "emi", "tenure", "repayment", "prepayment",
    "foreclosure", "down payment", "ltv", "collateral", "principal", "subsidy",
    "pmay", "repo", "floating rate", "fixed rate", "processing fee", "penalty",
    "balance", "transfer", "transaction", "valuation", "sanction", "disbursement",
    # transfers / channels
    "neft", "rtgs", "imps", "upi", "atm", "cheque", "branch", "passbook",
    "statement", "mobile banking", "net banking", "internet banking", "ifsc",
    # KYC / docs
    "kyc", "pan", "aadhaar", "cibil", "credit score", "passport", "voter id",
    "driving license", "documents", "salary slip", "income proof", "form 16",
    "itr", "gst",
]

# Used only as a fallback gate for queries with no explicit keyword.
BANKING_ANCHORS = [
    "account", "loan", "credit card", "debit card", "savings", "deposit",
    "interest rate", "KYC", "NEFT", "RTGS", "IMPS", "EMI", "branch",
    "ATM", "cheque", "mobile banking", "net banking", "fixed deposit",
    "mortgage", "balance", "transfer", "transaction", "PAN", "Aadhaar",
    "eligibility", "home loan", "documents required", "repayment", "NRI applicant",
]


# --- thresholds ---------------------------------------------------------------
# Effective values: env override wins, and the fingerprint is computed from
# whatever actually ends up here.

OOS_SIMILARITY_THRESHOLD = float(os.environ.get("ROUTER_OOS_THRESHOLD", "0.30"))
GUARD_GROUNDING_THRESHOLD = float(os.environ.get("GUARD_GROUNDING_THRESHOLD", "0.45"))
GUARD_OVERLAP_THRESHOLD = float(os.environ.get("GUARD_OVERLAP_THRESHOLD", "0.15"))
CACHE_SIMILARITY_THRESHOLD = float(os.environ.get("CACHE_SIMILARITY_THRESHOLD", "0.83"))
CACHE_MAX_ENTRIES = int(os.environ.get("CACHE_MAX_ENTRIES", "500"))


# --- snapshots ----------------------------------------------------------------
def _fingerprint(payload: dict) -> str:
    """Short, stable hash of a rule set. Sorted keys so ordering never matters."""
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:8]


def escalation_rules() -> dict:
    """The rules that decide when the assistant stops answering on its own.

    Covers all four exits from the automated path: a sensitive-keyword handoff, an
    out-of-scope refusal, and the two grounding thresholds whose failure produces
    a fallback. `needs_human` in the metrics store is downstream of exactly these.
    """
    return {
        "escalation_keywords": sorted(ESCALATION_KEYWORDS),
        "oos_similarity_threshold": OOS_SIMILARITY_THRESHOLD,
        "guard_grounding_threshold": GUARD_GROUNDING_THRESHOLD,
        "guard_overlap_threshold": GUARD_OVERLAP_THRESHOLD,
    }


def routing_rules() -> dict:
    return {
        "smalltalk_patterns": sorted(SMALLTALK_PATTERNS),
        "banking_keywords": sorted(BANKING_KEYWORDS),
        "banking_anchors": sorted(BANKING_ANCHORS),
    }


def cache_rules() -> dict:
    return {
        "similarity_threshold": CACHE_SIMILARITY_THRESHOLD,
        "max_entries": CACHE_MAX_ENTRIES,
    }


def escalation_policy_id() -> str:
    return f"{ESCALATION_POLICY_VERSION}+{_fingerprint(escalation_rules())}"


def policy_id() -> str:
    return f"{POLICY_VERSION}+{_fingerprint(snapshot()['rules'])}"


def snapshot() -> dict:
    """Full, self-describing record of the policy currently in force."""
    return {
        "rules": {
            "escalation": escalation_rules(),
            "routing": routing_rules(),
            "cache": cache_rules(),
        },
        "escalation_policy": escalation_policy_id(),
        "declared_version": POLICY_VERSION,
    }


# --- registry -----------------------------------------------------------------
class PolicyRegistry:
    """Append-only log of every distinct policy observed at runtime.

    A stamped event is only auditable if the identifier can be resolved back to
    the rules it names, so each new `policy_id` is written out in full the first
    time it is seen. Snapshots are immutable once written — a later run with the
    same id advances `last_seen` and nothing else. If an id is ever seen with
    different rule content, the entry is flagged rather than overwritten, because
    silently rewriting history is the exact failure this module exists to prevent.
    """

    def __init__(self, path: Optional[Path] = None):
        self.path = path
        self._lock = threading.Lock()
        self._entries: dict = {}
        self._load()

    def _load(self) -> None:
        if not self.path or not Path(self.path).exists():
            return
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                self._entries = json.load(f)
        except Exception as e:  # noqa: BLE001
            print(f"[policy] failed to load {self.path}: {e}")
            self._entries = {}

    def _persist_locked(self) -> None:
        if not self.path:
            return
        try:
            tmp = Path(str(self.path) + ".tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self._entries, f, indent=2, sort_keys=True)
            tmp.replace(self.path)
        except Exception as e:  # noqa: BLE001
            print(f"[policy] failed to persist {self.path}: {e}")

    def register_current(self) -> str:
        """Record the policy in force now. Returns its id."""
        pid = policy_id()
        snap = snapshot()
        now = time.time()
        with self._lock:
            existing = self._entries.get(pid)
            if existing is None:
                self._entries[pid] = {
                    "policy_id": pid,
                    "escalation_policy": snap["escalation_policy"],
                    "first_seen": now,
                    "last_seen": now,
                    "rules": snap["rules"],
                }
            else:
                existing["last_seen"] = now
                # A fingerprint collision or a hand-edited registry: keep the
                # original and flag it. Never overwrite a recorded snapshot.
                if existing.get("rules") != snap["rules"]:
                    existing["conflict"] = True
            self._persist_locked()
        return pid

    def list_versions(self) -> list:
        with self._lock:
            return sorted(
                self._entries.values(), key=lambda e: e["first_seen"], reverse=True
            )

    def resolve(self, pid: str) -> Optional[dict]:
        with self._lock:
            return self._entries.get(pid)
