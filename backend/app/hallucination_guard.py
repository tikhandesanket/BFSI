"""Hallucination reduction layer.

Two cheap, deterministic checks applied after the LLM generates an answer:

1. Retrieval-grounding score — the answer's semantic overlap with the retrieved
   passages must exceed a threshold. Anything below is flagged as ungrounded.

2. Token-overlap with sources — the answer must share a minimum fraction of
   content words with the retrieved passages. Catches the case where a fluent
   answer drifts away from the source material.

If a generated answer fails either check, the system falls back to a templated
extractive answer built from the top retrieved passage. This prevents the model
from confidently fabricating banking policy that does not exist in the KB.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List

import numpy as np
from sentence_transformers import SentenceTransformer

from .rag_engine import RetrievalResult

STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "of", "to", "in", "on",
    "for", "and", "or", "but", "with", "as", "by", "at", "from", "this", "that",
    "it", "you", "your", "i", "we", "they", "our", "us", "can", "may", "will",
    "would", "should", "could", "have", "has", "had", "do", "does", "did",
}


@dataclass
class GuardResult:
    grounded: bool
    grounding_score: float
    overlap: float
    reason: str


def _tokenize(text: str) -> set[str]:
    tokens = re.findall(r"[a-zA-Z][a-zA-Z0-9_-]+", text.lower())
    return {t for t in tokens if t not in STOPWORDS and len(t) > 2}


class HallucinationGuard:
    def __init__(
        self,
        model: SentenceTransformer,
        grounding_threshold: float = 0.45,
        overlap_threshold: float = 0.15,
    ):
        self.model = model
        self.grounding_threshold = grounding_threshold
        self.overlap_threshold = overlap_threshold

    def check(self, answer: str, sources: List[RetrievalResult]) -> GuardResult:
        if not sources:
            return GuardResult(False, 0.0, 0.0, "no sources retrieved")

        source_text = " ".join(s.document.content for s in sources)

        ans_emb = self.model.encode([answer], normalize_embeddings=True, convert_to_numpy=True).astype("float32")
        src_emb = self.model.encode([source_text], normalize_embeddings=True, convert_to_numpy=True).astype("float32")
        grounding = float((ans_emb @ src_emb.T).squeeze())

        ans_tokens = _tokenize(answer)
        src_tokens = _tokenize(source_text)
        overlap = len(ans_tokens & src_tokens) / max(len(ans_tokens), 1)

        if grounding < self.grounding_threshold:
            return GuardResult(False, grounding, overlap, "low semantic grounding")
        if overlap < self.overlap_threshold:
            return GuardResult(False, grounding, overlap, "low token overlap with sources")
        return GuardResult(True, grounding, overlap, "passed")


def build_extractive_fallback(query: str, sources: List[RetrievalResult]) -> str:
    """If the LLM answer fails guarding, return a safe quote of the top source."""
    if not sources:
        return (
            "I could not find a confident answer in our banking knowledge base. "
            "Please rephrase your question or contact a human agent."
        )
    top = sources[0].document
    return (
        f"Based on our knowledge base — *{top.title}* — here is the relevant policy:\n\n"
        f"“{top.content}”\n\n"
        "If you need clarification, please contact a human agent."
    )
