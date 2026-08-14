"""Semantic answer cache.

Caches full chat responses keyed by the *meaning* of the question rather than an
exact string match. When a new query's embedding is close enough (cosine
similarity above a threshold) to a previously answered one, the stored answer is
returned immediately — skipping retrieval, the LLM call, and the hallucination
guard. This is the classic "similar question" cache: paraphrases like

    "what are home loan eligibility rules"
    "who is eligible for a home loan"

collapse onto the same cached answer.

The cache is in-memory with a small JSON persistence file so it survives
restarts. Embeddings are L2-normalized, so a dot product == cosine similarity.
"""

from __future__ import annotations

import json
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

import numpy as np

from .policy import CACHE_MAX_ENTRIES, CACHE_SIMILARITY_THRESHOLD

# Tuned for all-MiniLM-L6-v2: strong paraphrases land ~0.84-0.93, while
# unrelated banking questions sit below ~0.5, so 0.83 catches "similar questions"
# without collapsing distinct ones. Defined in policy.py (override via env there)
# so the value is covered by the recorded policy fingerprint.
DEFAULT_THRESHOLD = CACHE_SIMILARITY_THRESHOLD
DEFAULT_MAX_ENTRIES = CACHE_MAX_ENTRIES


@dataclass
class CacheEntry:
    query: str
    embedding: np.ndarray            # L2-normalized float32 vector
    payload: dict                    # the ChatResponse fields to replay
    created_at: float = field(default_factory=time.time)
    last_used: float = field(default_factory=time.time)
    hits: int = 0


@dataclass
class CacheLookup:
    entry: CacheEntry
    similarity: float


class SemanticCache:
    """Cosine-similarity cache over query embeddings.

    Thread-safe. Callers pass in a pre-computed, normalized query embedding so we
    never re-encode (the RAG engine already encodes each query for retrieval).
    """

    def __init__(
        self,
        path: Optional[Path] = None,
        threshold: float = DEFAULT_THRESHOLD,
        max_entries: int = DEFAULT_MAX_ENTRIES,
    ):
        self.path = path
        self.threshold = threshold
        self.max_entries = max_entries
        self._entries: List[CacheEntry] = []
        self._lock = threading.Lock()
        self._load()

    # ------------------------------------------------------------------ lookup
    def lookup(self, embedding: np.ndarray) -> Optional[CacheLookup]:
        """Return the best cached entry above the similarity threshold, or None."""
        with self._lock:
            if not self._entries:
                return None
            matrix = np.vstack([e.embedding for e in self._entries])
            sims = matrix @ embedding.reshape(-1)
            best_idx = int(np.argmax(sims))
            best_sim = float(sims[best_idx])
            if best_sim >= self.threshold:
                entry = self._entries[best_idx]
                entry.hits += 1
                entry.last_used = time.time()
                self._persist_locked()
                return CacheLookup(entry=entry, similarity=best_sim)
            return None

    # ------------------------------------------------------------------- store
    def store(self, query: str, embedding: np.ndarray, payload: dict) -> None:
        with self._lock:
            self._entries.append(
                CacheEntry(query=query, embedding=embedding.astype("float32"), payload=payload)
            )
            # Evict least-recently-used entries when over capacity.
            if len(self._entries) > self.max_entries:
                self._entries.sort(key=lambda e: e.last_used, reverse=True)
                self._entries = self._entries[: self.max_entries]
            self._persist_locked()

    def clear(self) -> int:
        with self._lock:
            n = len(self._entries)
            self._entries = []
            self._persist_locked()
            return n

    def stats(self) -> dict:
        with self._lock:
            total_hits = sum(e.hits for e in self._entries)
            return {
                "entries": len(self._entries),
                "total_hits": total_hits,
                "threshold": self.threshold,
                "max_entries": self.max_entries,
            }

    def entries_public(self) -> List[dict]:
        with self._lock:
            return [
                {
                    "query": e.query,
                    "hits": e.hits,
                    "created_at": e.created_at,
                    "last_used": e.last_used,
                }
                for e in sorted(self._entries, key=lambda x: x.hits, reverse=True)
            ]

    # --------------------------------------------------------------- persistence
    def _load(self) -> None:
        if not self.path or not Path(self.path).exists():
            return
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            for item in raw:
                self._entries.append(
                    CacheEntry(
                        query=item["query"],
                        embedding=np.asarray(item["embedding"], dtype="float32"),
                        payload=item["payload"],
                        created_at=item.get("created_at", time.time()),
                        last_used=item.get("last_used", time.time()),
                        hits=item.get("hits", 0),
                    )
                )
        except Exception as e:  # noqa: BLE001 — a corrupt cache must never crash boot
            print(f"[cache] failed to load {self.path}: {e}")

    def _persist_locked(self) -> None:
        if not self.path:
            return
        try:
            data = [
                {
                    "query": e.query,
                    "embedding": e.embedding.astype(float).tolist(),
                    "payload": e.payload,
                    "created_at": e.created_at,
                    "last_used": e.last_used,
                    "hits": e.hits,
                }
                for e in self._entries
            ]
            tmp = Path(str(self.path) + ".tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f)
            tmp.replace(self.path)
        except Exception as e:  # noqa: BLE001 — persistence is best-effort
            print(f"[cache] failed to persist {self.path}: {e}")
