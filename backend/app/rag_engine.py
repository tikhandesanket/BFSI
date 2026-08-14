"""RAG engine: builds a FAISS index over the banking knowledge base and
retrieves the most relevant documents for a given query.

Supports two document sources:
  1. Built-in corpus from `data/banking_kb.json` (immutable, loaded at start).
  2. User-uploaded chunks managed by `DocumentStore` (added/removed at runtime).

The FAISS index is rebuilt in-process whenever documents are added or removed —
cheap enough for a few thousand chunks, simple enough to reason about.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, List, Optional

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

from .document_store import ChunkRecord, DocumentStore

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_PATH = DATA_DIR / "banking_kb.json"
EMBED_MODEL_NAME = os.environ.get("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")


def content_hash(text: str) -> str:
    """Short digest of a document's text.

    Document ids are not stable evidence: a KB entry can be edited in place, and
    a file can be re-uploaded with the same name and category but different
    content. The id stays the same while the material behind an answer changes.
    Hashing the content gives each *version* of a document its own identity, so a
    logged answer points at the exact text that produced it.
    """
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()[:12]


@dataclass
class Document:
    id: str
    category: str
    title: str
    content: str
    source: str = "kb"  # "kb" for built-in, "upload" for user-supplied
    content_hash: str = field(default="", compare=False)

    def __post_init__(self) -> None:
        if not self.content_hash:
            self.content_hash = content_hash(self.content)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "category": self.category,
            "title": self.title,
            "content": self.content,
            "source": self.source,
            "content_hash": self.content_hash,
        }


@dataclass
class RetrievalResult:
    document: Document
    score: float


def _chunk_to_document(c: ChunkRecord) -> Document:
    return Document(
        id=c.id,
        category=c.category,
        title=c.title,
        content=c.content,
        source="upload",
    )


class RAGEngine:
    def __init__(self, data_path: Path = DATA_PATH, data_dir: Path = DATA_DIR):
        self.data_path = data_path
        self.model = SentenceTransformer(EMBED_MODEL_NAME)
        self.store = DocumentStore(data_dir=data_dir)
        self._lock = threading.Lock()
        self.documents: List[Document] = []
        self.index: Optional[faiss.Index] = None
        self._dim: Optional[int] = None
        self._build_index()

    # -------------------------------------------------------------------- build

    def _load_base_documents(self) -> List[Document]:
        with open(self.data_path, "r", encoding="utf-8") as f:
            raw = json.load(f)
        return [Document(source="kb", **item) for item in raw]

    def _encode(self, texts: List[str]) -> np.ndarray:
        return self.model.encode(
            texts, normalize_embeddings=True, convert_to_numpy=True
        ).astype("float32")

    def _new_index(self, dim: int) -> faiss.Index:
        return faiss.IndexFlatIP(dim)  # cosine sim on L2-normalized vectors

    def _build_index(self) -> None:
        base = self._load_base_documents()
        uploaded = [_chunk_to_document(c) for c in self.store.chunks]
        self.documents = base + uploaded

        if not self.documents:
            self._dim = self.model.get_sentence_embedding_dimension()
            self.index = self._new_index(self._dim)
            return

        texts = [f"{d.title}. {d.content}" for d in self.documents]
        embeddings = self._encode(texts)
        self._dim = embeddings.shape[1]
        self.index = self._new_index(self._dim)
        self.index.add(embeddings)

    # ------------------------------------------------------------------ public

    def embed_query(self, query: str) -> np.ndarray:
        """Return the L2-normalized embedding for a single query (shape: [dim]).
        Exposed so the semantic cache and retrieval can share one encode call."""
        return self._encode([query])[0]

    def retrieve(
        self, query: str, top_k: int = 4, query_embedding: Optional[np.ndarray] = None
    ) -> List[RetrievalResult]:
        if not self.index or not self.documents:
            return []
        q_emb = (
            query_embedding.reshape(1, -1).astype("float32")
            if query_embedding is not None
            else self._encode([query])
        )
        scores, idxs = self.index.search(q_emb, top_k)

        results: List[RetrievalResult] = []
        for score, idx in zip(scores[0], idxs[0]):
            if idx < 0 or idx >= len(self.documents):
                continue
            results.append(
                RetrievalResult(document=self.documents[int(idx)], score=float(score))
            )
        return results

    def categories(self) -> List[str]:
        return sorted({d.category for d in self.documents})

    # ------------------------------------------------------------ provenance
    def document_hashes(self) -> dict:
        """Current id → content hash for every indexed document."""
        return {d.id: d.content_hash for d in self.documents}

    def corpus_version(self) -> str:
        """Fingerprint of the whole knowledge base as it stands right now.

        Changes when a document is added, removed, or edited. Stamped on each
        answer so "was the KB the same when these two answers were given?" is one
        comparison instead of a diff over the corpus.
        """
        pairs = sorted((d.id, d.content_hash) for d in self.documents)
        blob = json.dumps(pairs, separators=(",", ":"))
        return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:12]

    @staticmethod
    def source_refs(results: List["RetrievalResult"], limit: int = 4) -> List[dict]:
        """Compact provenance for the metrics log: which document versions were
        actually put in front of the model, and how strongly each matched."""
        return [
            {
                "id": r.document.id,
                "hash": r.document.content_hash,
                "score": round(float(r.score), 4),
            }
            for r in results[:limit]
        ]

    # ----------------------------------------------------------- upload / remove

    def add_uploaded_file(
        self, filename: str, data: bytes, category: Optional[str] = None
    ) -> dict:
        with self._lock:
            record, chunks = self.store.add_file(filename, data, category=category)
            new_docs = [_chunk_to_document(c) for c in chunks]
            texts = [f"{d.title}. {d.content}" for d in new_docs]
            embeddings = self._encode(texts)
            if self.index is None:
                self._dim = embeddings.shape[1]
                self.index = self._new_index(self._dim)
            self.index.add(embeddings)
            self.documents.extend(new_docs)
            return record.to_public()

    def remove_upload(self, upload_id: str) -> Optional[dict]:
        with self._lock:
            record = self.store.delete(upload_id)
            if record is None:
                return None
            # Rebuilding is simpler and correct; index is in-memory and small.
            self._build_index()
            return record.to_public()

    def _delete_base_document(self, doc_id: str) -> bool:
        """Physically remove a built-in KB entry from banking_kb.json.
        Hard delete: the entry is gone from disk and will not return on restart.
        Returns True if an entry was removed."""
        with open(self.data_path, "r", encoding="utf-8") as f:
            raw = json.load(f)
        remaining = [item for item in raw if item.get("id") != doc_id]
        if len(remaining) == len(raw):
            return False
        tmp = self.data_path.with_suffix(".json.tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(remaining, f, ensure_ascii=False, indent=2)
        tmp.replace(self.data_path)
        return True

    def delete_document(self, doc_id: str) -> Optional[dict]:
        """Delete either an uploaded file (by upload id) or a built-in KB entry
        (by document id, e.g. "loan-001"). Rebuilds the index either way so the
        removed content stops being retrieved. Returns a summary or None if the
        id matched nothing."""
        with self._lock:
            record = self.store.delete(doc_id)
            if record is not None:
                self._build_index()
                return {"kind": "upload", "id": record.id}
            if self._delete_base_document(doc_id):
                self._build_index()
                return {"kind": "kb", "id": doc_id}
            return None

    def list_uploads(self) -> List[dict]:
        return self.store.list_uploads()

    # -------------------------------------------------------------------- stats

    def stats(self) -> dict:
        kb_count = sum(1 for d in self.documents if d.source == "kb")
        upload_count = len(self.documents) - kb_count
        return {
            "documents": len(self.documents),
            "kb_documents": kb_count,
            "uploaded_chunks": upload_count,
            "uploaded_files": len(self.store.uploads),
            "categories": self.categories(),
        }
