"""Intelligent query router.

Classifies an incoming user query into one of:
  - "smalltalk"  : greeting / chit-chat (no RAG needed)
  - "out_of_scope": question that is clearly not banking related (refuse politely)
  - "kb"          : route to RAG retrieval over the knowledge base
  - "escalate"    : sensitive request that should go to a human agent (fraud, dispute)

The router uses lightweight keyword + semantic-similarity rules so the system
remains deterministic and audit-friendly — important for banking compliance.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

import numpy as np
from sentence_transformers import SentenceTransformer

SMALLTALK_PATTERNS = [
    "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
    "how are you", "thanks", "thank you", "bye", "goodbye",
]

ESCALATION_KEYWORDS = [
    "fraud", "stolen", "unauthorized", "scam", "phishing", "dispute",
    "complaint", "chargeback", "hack", "compromised",
]

BANKING_ANCHORS = [
    "account", "loan", "credit card", "debit card", "savings", "deposit",
    "interest rate", "KYC", "NEFT", "RTGS", "IMPS", "EMI", "branch",
    "ATM", "cheque", "mobile banking", "net banking", "fixed deposit",
    "mortgage", "balance", "transfer", "transaction", "PAN", "Aadhaar",
]


@dataclass
class RoutingDecision:
    route: str            # "smalltalk" | "out_of_scope" | "kb" | "escalate"
    confidence: float
    reason: str


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

        if not q:
            return RoutingDecision("out_of_scope", 1.0, "empty query")

        # 1. Small-talk: short greetings / pleasantries.
        if any(q == p or q.startswith(p + " ") or q.startswith(p + "!") for p in SMALLTALK_PATTERNS):
            return RoutingDecision("smalltalk", 0.95, "matched smalltalk pattern")

        # 2. Escalation: fraud / dispute terms → human agent.
        if any(kw in q for kw in ESCALATION_KEYWORDS):
            return RoutingDecision("escalate", 0.9, "sensitive keyword detected")

        # 3. Banking-domain check via semantic similarity to anchors.
        sim = self._max_anchor_similarity(q)
        if sim < 0.35:
            return RoutingDecision("out_of_scope", 1.0 - sim, f"low banking similarity ({sim:.2f})")

        return RoutingDecision("kb", sim, f"banking similarity {sim:.2f}")
