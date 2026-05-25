"""RAG engine: builds a FAISS index over the banking knowledge base and retrieves
the most relevant documents for a given query."""

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import List

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "banking_kb.json"
EMBED_MODEL_NAME = os.environ.get("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")


@dataclass
class Document:
    id: str
    category: str
    title: str
    content: str

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "category": self.category,
            "title": self.title,
            "content": self.content,
        }


@dataclass
class RetrievalResult:
    document: Document
    score: float


class RAGEngine:
    def __init__(self, data_path: Path = DATA_PATH):
        self.data_path = data_path
        self.model = SentenceTransformer(EMBED_MODEL_NAME)
        self.documents: List[Document] = []
        self.index: faiss.Index | None = None
        self._build_index()

    def _build_index(self) -> None:
        with open(self.data_path, "r", encoding="utf-8") as f:
            raw = json.load(f)

        self.documents = [Document(**item) for item in raw]
        texts = [f"{d.title}. {d.content}" for d in self.documents]
        embeddings = self.model.encode(texts, normalize_embeddings=True, convert_to_numpy=True)

        dim = embeddings.shape[1]
        # Inner product on L2-normalized vectors == cosine similarity.
        self.index = faiss.IndexFlatIP(dim)
        self.index.add(embeddings.astype("float32"))

    def retrieve(self, query: str, top_k: int = 4) -> List[RetrievalResult]:
        if not self.index:
            return []
        q_emb = self.model.encode([query], normalize_embeddings=True, convert_to_numpy=True).astype("float32")
        scores, idxs = self.index.search(q_emb, top_k)

        results: List[RetrievalResult] = []
        for score, idx in zip(scores[0], idxs[0]):
            if idx < 0 or idx >= len(self.documents):
                continue
            results.append(RetrievalResult(document=self.documents[int(idx)], score=float(score)))
        return results

    def categories(self) -> List[str]:
        return sorted({d.category for d in self.documents})
