"""FastAPI entrypoint for the Banking Knowledge Assistant."""

from __future__ import annotations

import time
import uuid
from typing import List, Optional

from dotenv import load_dotenv
from .interrupt_store import InterruptStore

# Load .env (Azure/OpenAI keys, model config) before anything reads os.environ.
load_dotenv()

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .document_store import EmptyDocument, UnsupportedFileType
from .hallucination_guard import HallucinationGuard, build_extractive_fallback
from .llm import generate_answer, is_refusal
from .metrics import MetricsStore, cost_from_tokens, estimate_cost
from .policy import PolicyRegistry, snapshot as policy_snapshot
from .query_router import QueryRouter
from .rag_engine import DATA_DIR, RAGEngine
from .semantic_cache import SemanticCache

app = FastAPI(title="Banking Knowledge Assistant", version="0.2.0")

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
cache = SemanticCache(path=DATA_DIR / "semantic_cache.json")
metrics = MetricsStore(path=DATA_DIR / "metrics.json")

# Record the rules in force at boot, so every policy id stamped on an event this
# run can be resolved back to its full rule set later.
policy_registry = PolicyRegistry(path=DATA_DIR / "policy_versions.json")
hitl_store = InterruptStore(
    db_path=DATA_DIR / "human_reviews.db"
)
POLICY_ID = policy_registry.register_current()

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


# --- schemas ------------------------------------------------------------------

class HumanDecisionRequest(BaseModel):
    decision: str = Field(..., pattern="^(approved|rejected)$")
    reviewer_id: str = Field(..., min_length=1, max_length=100)
    reason: str = Field(..., min_length=1, max_length=1000)

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    top_k: int = Field(default=8, ge=1, le=12)


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
    cached: bool = False
    cache_similarity: Optional[float] = None


class MetricsResponse(BaseModel):
    days: int
    total_queries: int
    cache_hits: int
    llm_calls: int
    hit_rate: float
    cost_incurred_usd: float
    cost_saved_usd: float
    cost_baseline_usd: float
    savings_pct: float
    avg_latency_ms: int
    by_source: dict
    by_day: List[dict]
    fallbacks: dict
    deflection: dict
    cache: dict
    policy: dict


class UploadResponse(BaseModel):
    id: str
    filename: str
    category: str
    size_bytes: int
    chunks: int
    chars: int
    uploaded_at: float
    format: str = "text"
    structure: str = "unstructured"


class DocumentsListResponse(BaseModel):
    uploads: List[UploadResponse]
    stats: dict

class HumanReviewCreateRequest(BaseModel):
    case_type: str = Field(..., pattern="^pep_onboarding$")
    case_reference: str = Field(..., min_length=1, max_length=100)
# --- endpoints ----------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    stats = rag.stats()
    return {"status": "ok", "policy_version": POLICY_ID, **stats}


@app.get("/metrics", response_model=MetricsResponse)
def get_metrics(days: int = 30) -> MetricsResponse:
    """Usage + cost analytics over the last `days` days (7 / 15 / 30 in the UI)."""
    days = max(1, min(days, 90))
    summary = metrics.summary(days)
    return MetricsResponse(**summary, cache=cache.stats())


@app.get("/policy")
def get_policy() -> dict:
    """The decision policy in force now, plus every version this deployment has
    recorded. Lets an auditor resolve the `policy_version` on any logged event
    back to the exact rules that produced it."""
    return {
        "current": POLICY_ID,
        **policy_snapshot(),
        "history": policy_registry.list_versions(),
    }


@app.post("/metrics/reset")
def reset_metrics() -> dict:
    removed = metrics.reset()
    return {"status": "reset", "removed": removed}


@app.post("/cache/clear")
def clear_cache() -> dict:
    removed = cache.clear()
    return {"status": "cleared", "removed": removed}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    t0 = time.perf_counter()
    decision = router.route(req.query)
    
    # HITL: route PEP onboarding requests for human review.
    normalized_query = req.query.lower()
    padded_query = f" {normalized_query} "

    mentions_pep = (
        " pep " in padded_query
        or "politically exposed person" in normalized_query
        or "politically exposed persons" in normalized_query
    )

    onboarding_terms = (
        "onboard",
        "onboarding",
        "open an account",
        "account opening",
        "customer application",
    )

    is_onboarding_request = any(
        term in normalized_query for term in onboarding_terms
    )

    if mentions_pep and is_onboarding_request:
        case_reference = f"CHAT-{uuid.uuid4().hex[:12].upper()}"

        review = hitl_store.create_review(
            query=req.query,
            context={
                "case_type": "pep_onboarding",
                "case_reference": case_reference,
                "required_checks": [
                    "Enhanced Due Diligence",
                    "Senior management approval",
                ],
                "policy_basis": (
                    "Banking knowledge base states that PEPs require "
                    "Enhanced Due Diligence and senior management approval."
                ),
            },
        )

        latency = int((time.perf_counter() - t0) * 1000)

        resp = ChatResponse(
            answer=(
                "This PEP onboarding request requires human review. "
                "The case has been created and is awaiting a decision. "
                f"Review ID: {review['id']}. "
                "No onboarding approval has been granted."
            ),
            route="human_review",
            confidence=1.0,
            grounded=True,
            grounding_score=1.0,
            overlap=1.0,
            sources=[],
            latency_ms=latency,
        )

        metrics.record(
            source="hitl",
            route="human_review",
            latency_ms=latency,
            query=req.query,
            needs_human=True,
        )

        return resp


    if decision.route == "smalltalk":
        resp = ChatResponse(
            answer="Hello! I'm your banking knowledge assistant. Ask me about accounts, loans, cards, transfers, or compliance.",
            route=decision.route,
            confidence=decision.confidence,
            grounded=True,
            grounding_score=1.0,
            overlap=1.0,
            sources=[],
            latency_ms=int((time.perf_counter() - t0) * 1000),
        )
        metrics.record(
            source="router", route=decision.route, latency_ms=resp.latency_ms,
            query=req.query, escalation_policy=decision.escalation_policy,
        )
        return resp

    if decision.route == "out_of_scope":
        resp = ChatResponse(
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
        metrics.record(
            source="router", route=decision.route, latency_ms=resp.latency_ms,
            query=req.query, escalation_policy=decision.escalation_policy,
        )
        return resp

    if decision.route == "escalate":
        results = rag.retrieve(req.query, top_k=req.top_k)
        sources = [
            Source(id=r.document.id, title=r.document.title, category=r.document.category,
                   snippet=r.document.content[:240], score=r.score)
            for r in results
        ]
        resp = ChatResponse(
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
        # A fraud/dispute escalation is a deliberate human handoff — not deflected.
        metrics.record(
            source="router", route=decision.route, latency_ms=resp.latency_ms,
            query=req.query, needs_human=True,
            escalation_policy=decision.escalation_policy,
            sources=rag.source_refs(results),
            corpus_version=rag.corpus_version(),
        )
        return resp

    # decision.route == "kb" — the expensive path we cache.
    q_emb = rag.embed_query(req.query)

    # 1. Semantic cache: has a similar question already been answered?
    hit = cache.lookup(q_emb)
    if hit is not None:
        payload = hit.entry.payload
        latency = int((time.perf_counter() - t0) * 1000)
        # A replayed answer was written against a specific version of each source
        # document. If any of those documents has since been edited, re-uploaded
        # or deleted, the answer is being served from material that no longer
        # exists. Flag it on the record — the answer itself is unchanged, but an
        # auditor needs to see that its evidence moved.
        # Entries cached before source pinning existed carry no refs. Report that
        # as unknown (None), never as False — claiming "sources unchanged" when
        # we simply cannot tell is worse than admitting the gap.
        cached_refs = payload.get("_source_refs")
        if cached_refs is None:
            stale = None
        else:
            current_hashes = rag.document_hashes()
            stale = any(current_hashes.get(r["id"]) != r["hash"] for r in cached_refs)
        # A cache hit serves an answer instantly with no human and no LLM call —
        # always a deflection. We only cache grounded answers (see below), so a
        # hit never replays a fallback.
        metrics.record(
            source="cache",
            route=decision.route,
            latency_ms=latency,
            cost_saved_usd=payload.get("_cost_usd", 0.0),
            similarity=hit.similarity,
            query=req.query,
            escalation_policy=decision.escalation_policy,
            sources=cached_refs,
            corpus_version=payload.get("_corpus_version"),
            grounding_score=payload.get("grounding_score"),
            overlap=payload.get("overlap"),
            sources_changed=stale,
        )
        return ChatResponse(
            answer=payload["answer"],
            route=payload["route"],
            confidence=payload["confidence"],
            grounded=payload["grounded"],
            grounding_score=payload["grounding_score"],
            overlap=payload["overlap"],
            sources=[Source(**s) for s in payload["sources"]],
            latency_ms=latency,
            cached=True,
            cache_similarity=round(hit.similarity, 4),
        )

    # 2. Cache miss: run the full RAG pipeline.
    results = rag.retrieve(req.query, top_k=req.top_k, query_embedding=q_emb)
    generation = generate_answer(req.query, results)
    answer = generation.answer

    # Classify the outcome BEFORE any answer substitution so we can log *why* a
    # question did (or didn't) get a real, grounded answer.
    guard_result = guard.check(answer, results)
    refusal = is_refusal(answer)
    if not generation.used_llm:
        fallback_reason = "no_llm"          # no model reachable — raw passage served
    elif refusal:
        fallback_reason = "kb_gap"          # model honestly declined — KB lacks it
    elif not guard_result.grounded:
        fallback_reason = "guard_rejected"  # answer failed the grounding check
    else:
        fallback_reason = None              # genuine grounded answer delivered
    answered = fallback_reason is None

    # Only fall back for ungrounded *fabrications*. An honest "not in our KB"
    # refusal is already safe — replacing it with a raw chunk dump is worse.
    if not guard_result.grounded and not refusal:
        answer = build_extractive_fallback(req.query, results)

    sources = [
        Source(id=r.document.id, title=r.document.title, category=r.document.category,
               snippet=r.document.content[:240], score=r.score)
        for r in results
    ]
    # Document *versions* behind this answer, captured at answer time. Ids alone
    # are not enough: a KB entry can be edited, or a file re-uploaded under the
    # same name, leaving the id intact while the evidence changes.
    source_refs = rag.source_refs(results)
    corpus_v = rag.corpus_version()

    latency = int((time.perf_counter() - t0) * 1000)
    # Cost is only incurred when a real model call was made. Prefer the exact token
    # usage the API reported; fall back to a text-length estimate only if absent.
    if not generation.used_llm:
        cost = 0.0
    elif generation.prompt_tokens is not None and generation.completion_tokens is not None:
        cost = cost_from_tokens(generation.prompt_tokens, generation.completion_tokens)
    else:
        cost = estimate_cost(generation.prompt, answer)

    resp = ChatResponse(
        answer=answer,
        route=decision.route,
        confidence=decision.confidence,
        grounded=guard_result.grounded,
        grounding_score=guard_result.grounding_score,
        overlap=guard_result.overlap,
        sources=sources,
        latency_ms=latency,
        cached=False,
    )

    # 3. Only cache genuine grounded answers — never a fallback or refusal, so a
    # future cache hit can never replay a non-answer. We keep the real cost
    # alongside so a hit can report the money it saved.
    if answered:
        payload = resp.model_dump()
        payload["_cost_usd"] = cost
        # Pin the exact document versions this answer was written from, so a
        # future replay can tell whether they still say the same thing.
        payload["_source_refs"] = source_refs
        payload["_corpus_version"] = corpus_v
        cache.store(req.query, q_emb, payload)

    # A fallback/refusal means the user didn't get a usable answer — flag it for the
    # human-agent deflection metric and the "questions that triggered a fallback" list.
    metrics.record(
        source="llm" if generation.used_llm else "extractive",
        route=decision.route,
        latency_ms=latency,
        cost_usd=cost,
        query=req.query,
        fallback_reason=fallback_reason,
        needs_human=not answered,
        escalation_policy=decision.escalation_policy,
        sources=source_refs,
        corpus_version=corpus_v,
        grounding_score=guard_result.grounding_score,
        overlap=guard_result.overlap,
    )
    return resp


# --- ingest -------------------------------------------------------------------
@app.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    category: Optional[str] = Form(default=None),
) -> UploadResponse:
    """Ingest a TXT / MD / PDF / JSON file. Chunks + embeds + indexes server-side."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum size of {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )
    try:
        record = rag.add_uploaded_file(file.filename or "document", data, category=category)
    except UnsupportedFileType as e:
        raise HTTPException(status_code=415, detail=str(e))
    except EmptyDocument as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001 — surface a clean error to the UI
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")
    return UploadResponse(**record)


@app.get("/documents", response_model=DocumentsListResponse)
def list_documents() -> DocumentsListResponse:
    return DocumentsListResponse(
        uploads=[UploadResponse(**u) for u in rag.list_uploads()],
        stats=rag.stats(),
    )


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str) -> dict:
    """Delete an uploaded file (by upload id) or a built-in KB entry (by document
    id such as "loan-001", shown on each chat source card). KB entries are hard-
    deleted from banking_kb.json and will not return on restart."""
    record = rag.delete_document(doc_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {"status": "deleted", "id": record["id"], "kind": record["kind"]}
# --- human-in-the-loop reviews -----------------------------------------------

@app.get("/human-reviews")
def list_human_reviews():
    """List reviews waiting for human decisions."""
    return {"reviews": hitl_store.list_pending()}


@app.get("/human-reviews/{review_id}")
def get_human_review(review_id: str):
    """Retrieve one review by its ID."""
    review = hitl_store.get_review(review_id)

    if review is None:
        raise HTTPException(status_code=404, detail="Review not found.")

    return review


@app.post("/human-reviews/{review_id}/decision")
def decide_human_review(
    review_id: str,
    req: HumanDecisionRequest,
):
    """Record an officer's decision for a pending review."""
    review = hitl_store.decide(
        review_id=review_id,
        decision=req.decision,
        reviewer_id=req.reviewer_id,
        reason=req.reason,
    )

    if review is None:
        existing = hitl_store.get_review(review_id)

        if existing is None:
            raise HTTPException(
                status_code=404,
                detail="Review not found.",
            )

        raise HTTPException(
            status_code=409,
            detail="This review has already been decided.",
        )

    return review

@app.post("/human-reviews", status_code=201)
def create_human_review(req: HumanReviewCreateRequest):

    """Create a review for a PEP onboarding case."""
    review = hitl_store.create_review(
        query=f"Review PEP onboarding case {req.case_reference}",
        context={
            "case_type": req.case_type,
            "case_reference": req.case_reference,
            "required_checks": [
                "Enhanced Due Diligence",
                "Senior management approval",
            ],
            "policy_basis": (
                "Banking knowledge base states that PEPs require "
                "Enhanced Due Diligence and senior management approval."
            ),
        },
    )
    return review


@app.get("/human-reviews/{review_id}/workflow-status")
def get_human_review_workflow_status(review_id: str):
    review = hitl_store.get_review(review_id)

    if review is None:
        raise HTTPException(
            status_code=404,
            detail="Review not found.",
        )

    if review["status"] == "pending":
        return {
            "review_id": review_id,
            "workflow_status": "waiting_for_human",
            "can_proceed": False,
            "message": "Waiting for a human decision.",
        }

    if review["status"] == "rejected":
        return {
            "review_id": review_id,
            "workflow_status": "stopped",
            "can_proceed": False,
            "message": "The human reviewer rejected this case.",
        }

    if review["edd_status"] != "completed":
        return {
            "review_id": review_id,
            "workflow_status": "waiting_for_edd",
            "can_proceed": False,
            "message": "Enhanced Due Diligence is not yet completed.",
        }

    return {
        "review_id": review_id,
        "workflow_status": "ready_for_final_checks",
        "can_proceed": False,
        "message": (
            "Human approval and EDD completion are recorded. "
            "Remaining required checks must be verified."
        ),
    }




@app.post("/human-reviews/{review_id}/edd-completion")
def complete_edd(review_id: str):
    review = hitl_store.get_review(review_id)

    if review is None:
        raise HTTPException(
            status_code=404,
            detail="Review not found.",
        )

    if review["status"] == "pending":
        raise HTTPException(
            status_code=409,
            detail="Human review is still pending.",
        )

    if review["status"] == "rejected":
        raise HTTPException(
            status_code=409,
            detail="Cannot complete EDD for a rejected case.",
        )

    updated_review = hitl_store.update_edd_status(
        review_id=review_id,
        edd_status="completed",
    )

    if updated_review is None:
        raise HTTPException(
            status_code=409,
            detail="Could not update EDD status.",
        )

    return {
        "review_id": review_id,
        "edd_status": updated_review["edd_status"],
        "workflow_status": "ready_for_final_checks",
        "can_proceed": False,
        "message": (
            "EDD status recorded. Verify all required checks "
            "before allowing onboarding to proceed."
        ),
    }

