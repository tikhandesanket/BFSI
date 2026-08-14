"""Text chunking for RAG ingestion.

Strategy: split on paragraph boundaries first, then greedily pack paragraphs
into windows of roughly `chunk_size` characters with `overlap` characters
carried over between consecutive chunks. Paragraphs that exceed the window
are word-wrapped instead of split mid-token.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List


@dataclass
class Chunk:
    index: int
    text: str


_PARAGRAPH_SPLIT = re.compile(r"\n\s*\n+")
_WHITESPACE = re.compile(r"[ \t]+")


def _normalize(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _WHITESPACE.sub(" ", text)
    return text.strip()


def _split_long(paragraph: str, chunk_size: int) -> List[str]:
    """Word-wrap a paragraph that's larger than chunk_size."""
    words = paragraph.split(" ")
    pieces: List[str] = []
    buf: List[str] = []
    length = 0
    for w in words:
        wl = len(w) + 1
        if length + wl > chunk_size and buf:
            pieces.append(" ".join(buf).strip())
            buf, length = [], 0
        buf.append(w)
        length += wl
    if buf:
        pieces.append(" ".join(buf).strip())
    return pieces


def chunk_text(text: str, chunk_size: int = 600, overlap: int = 100) -> List[Chunk]:
    """Split `text` into overlapping chunks.

    chunk_size and overlap are measured in characters. Empty input yields [].
    """
    text = _normalize(text)
    if not text:
        return []
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    overlap = max(0, min(overlap, chunk_size // 2))

    # First pass: paragraph-level units, splitting any over-large paragraph.
    units: List[str] = []
    for para in _PARAGRAPH_SPLIT.split(text):
        para = para.strip()
        if not para:
            continue
        if len(para) <= chunk_size:
            units.append(para)
        else:
            units.extend(_split_long(para, chunk_size))

    # Second pass: greedy pack into windows, carry overlap as a tail.
    chunks: List[str] = []
    current = ""
    for u in units:
        if not current:
            current = u
            continue
        if len(current) + 2 + len(u) <= chunk_size:
            current = f"{current}\n\n{u}"
        else:
            chunks.append(current)
            tail = current[-overlap:] if overlap else ""
            current = (tail + "\n\n" + u).strip() if tail else u
    if current:
        chunks.append(current)

    return [Chunk(index=i, text=c) for i, c in enumerate(chunks)]


def chunk_records(
    records: List[str],
    chunk_size: int = 800,
    header: str = "",
) -> List[Chunk]:
    """Chunker for structured data (CSV/XLSX rows, JSON list items).

    Each `record` is kept atomic — never split mid-record. Records are greedily
    packed into windows of roughly `chunk_size` characters. An optional `header`
    (e.g. "Sheet: Sales · Columns: name, amount, date") is prepended to every
    chunk so retrieval keeps tabular context.
    """
    records = [r.strip() for r in records if r and r.strip()]
    if not records:
        return []
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")

    header_block = f"{header.strip()}\n\n" if header.strip() else ""
    budget = max(1, chunk_size - len(header_block))

    chunks: List[str] = []
    current = ""
    for r in records:
        # A single record can exceed `budget`; in that case emit it alone.
        if not current:
            current = r
            continue
        if len(current) + 2 + len(r) <= budget:
            current = f"{current}\n---\n{r}"
        else:
            chunks.append(header_block + current)
            current = r
    if current:
        chunks.append(header_block + current)

    return [Chunk(index=i, text=c) for i, c in enumerate(chunks)]
