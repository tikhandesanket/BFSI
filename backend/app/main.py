"""FastAPI entrypoint for the Banking Knowledge Assistant."""

from __future__ import annotations

import time
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .hallucination_guard import HallucinationGuard, build_extractive_fallback
from .llm import generate_answer
from .query_router import QueryRouter
from .rag_engine import RAGEngine

app = FastAPI(title="Banking Knowledge Assistant", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- singletons ---------------------------------------------------------------
rag = RAGEngine()
router = QueryRouter(model=rag.model)
guard = HallucinationGuard(model=rag.model)


# --- schemas ------------------------------------------------------------------
class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    top_k: int = Field(default=4, ge=1, le=10)


class Source(BaseModel):
    id: str
    title: str
    category: str
    snippet: str
    score: float


class ChatResponse(BaseModel):
    answer: str
    route: str
    confidence: float
    grounded: bool
    grounding_score: float
    overlap: float
    sources: List[Source]
    latency_ms: int


# --- endpoints ----------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {"status": "ok", "documents": len(rag.documents), "categories": rag.categories()}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    t0 = time.perf_counter()
    decision = router.route(req.query)

    if decision.route == "smalltalk":
        return ChatResponse(
            answer="Hello! I'm your banking knowledge assistant. Ask me about accounts, loans, cards, transfers, or compliance.",
            route=decision.route,
            confidence=decision.confidence,
            grounded=True,
            grounding_score=1.0,
            overlap=1.0,
            sources=[],
            latency_ms=int((time.perf_counter() - t0) * 1000),
        )

    if decision.route == "out_of_scope":
        return ChatResponse(
            answer=(
                "I can only help with banking-related questions — accounts, loans, "
                "cards, deposits, transfers, KYC, or fraud. Please rephrase your question."
            ),
            route=decision.route,
            confidence=decision.confidence,
            grounded=True,
            grounding_score=1.0,
            overlap=1.0,
            sources=[],
            latency_ms=int((time.perf_counter() - t0) * 1000),
        )

    if decision.route == "escalate":
        results = rag.retrieve(req.query, top_k=req.top_k)
        sources = [
            Source(id=r.document.id, title=r.document.title, category=r.document.category,
                   snippet=r.document.content[:240], score=r.score)
            for r in results
        ]
        return ChatResponse(
            answer=(
                "This sounds like a sensitive issue (fraud / dispute). For your safety, "
                "please call our 24x7 fraud helpline at 1800-XXX-XXXX or visit the nearest "
                "branch. I've also attached the relevant policy below for reference."
            ),
            route=decision.route,
            confidence=decision.confidence,
            grounded=True,
            grounding_score=1.0,
            overlap=1.0,
            sources=sources,
            latency_ms=int((time.perf_counter() - t0) * 1000),
        )

    # decision.route == "kb"
    results = rag.retrieve(req.query, top_k=req.top_k)
    answer = generate_answer(req.query, results)
    guard_result = guard.check(answer, results)
    if not guard_result.grounded:
        answer = build_extractive_fallback(req.query, results)

    sources = [
        Source(id=r.document.id, title=r.document.title, category=r.document.category,
               snippet=r.document.content[:240], score=r.score)
        for r in results
    ]

    return ChatResponse(
        answer=answer,
        route=decision.route,
        confidence=decision.confidence,
        grounded=guard_result.grounded,
        grounding_score=guard_result.grounding_score,
        overlap=guard_result.overlap,
        sources=sources,
        latency_ms=int((time.perf_counter() - t0) * 1000),
    )
