"""Intelligent query router.

Classifies an incoming user query into one of:
  - "smalltalk"  : greeting / chit-chat (no RAG needed)
  - "out_of_scope": question that is clearly not banking related (refuse politely)
  - "kb"          : route to RAG retrieval over the knowledge base
  - "escalate"    : sensitive request that should go to a human agent (fraud, dispute)

The router uses lightweight keyword + semantic-similarity rules so the system
remains deterministic and audit-friendly — important for banking compliance.

The rule data itself lives in `policy.py` so that every routing decision can be
stamped with the version of the rules that produced it. Editing the keyword lists
below would not change the recorded policy fingerprint; edit them in `policy.py`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List

import numpy as np
from sentence_transformers import SentenceTransformer

from .policy import (
    BANKING_ANCHORS,
    BANKING_KEYWORDS,
    ESCALATION_KEYWORDS,
    OOS_SIMILARITY_THRESHOLD,
    SMALLTALK_PATTERNS,
    escalation_policy_id,
)

_KEYWORD_RE = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in sorted(BANKING_KEYWORDS, key=len, reverse=True)) + r")\b",
    re.IGNORECASE,
)


@dataclass
class RoutingDecision:
    route: str            # "smalltalk" | "out_of_scope" | "kb" | "escalate"
    confidence: float
    reason: str
    # Version of the escalation rules that produced this decision, captured at
    # decision time so a later threshold change cannot re-attribute it.
    escalation_policy: str = ""


class QueryRouter:
    def __init__(self, model: SentenceTransformer):
        self.model = model
        self._anchor_emb = self.model.encode(
            BANKING_ANCHORS, normalize_embeddings=True, convert_to_numpy=True
        ).astype("float32")

    def _max_anchor_similarity(self, query: str) -> float:
        q = self.model.encode([query], normalize_embeddings=True, convert_to_numpy=True).astype("float32")
        sims = (self._anchor_emb @ q.T).squeeze()
        return float(np.max(sims))

    def route(self, query: str) -> RoutingDecision:
        q = query.strip().lower()
        # Resolved once per decision: every branch below is stamped with the same
        # rule version, even if the policy is reloaded mid-flight.
        pol = escalation_policy_id()

        if not q:
            return RoutingDecision("out_of_scope", 1.0, "empty query", pol)

        # 1. Small-talk: short greetings / pleasantries.
        if any(q == p or q.startswith(p + " ") or q.startswith(p + "!") for p in SMALLTALK_PATTERNS):
            return RoutingDecision("smalltalk", 0.95, "matched smalltalk pattern", pol)

        # 2. Escalation: fraud / dispute terms → human agent.
        if any(kw in q for kw in ESCALATION_KEYWORDS):
            return RoutingDecision("escalate", 0.9, "sensitive keyword detected", pol)

        # 3. Deterministic banking keyword → straight to KB (whole-word match).
        if _KEYWORD_RE.search(q):
            return RoutingDecision("kb", 0.9, "banking keyword matched", pol)

        # 4. Fallback for keyword-less queries: semantic similarity to anchors.
        sim = self._max_anchor_similarity(q)
        if sim < OOS_SIMILARITY_THRESHOLD:
            return RoutingDecision(
                "out_of_scope", 1.0 - sim, f"low banking similarity ({sim:.2f})", pol
            )

        return RoutingDecision("kb", sim, f"banking similarity {sim:.2f}", pol)
