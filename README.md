# Banking Knowledge Assistant

AI-powered banking support assistant built with **Retrieval-Augmented Generation (RAG)**, **intelligent query routing**, and **hallucination reduction**.

- **Backend** — FastAPI (Python) + FAISS vector index + sentence-transformers embeddings.
- **Frontend** — React + Vite + Tailwind CSS.
- **Optional LLM** — OpenAI-compatible API for answer synthesis. Without an API key, the backend falls back to a deterministic extractive answer from the top retrieved passage.

---

## Architecture

```
   user query
       │
       ▼
 ┌──────────────┐    smalltalk  ──► canned greeting
 │ Query Router │    out_of_scope ──► polite refusal
 │ (semantic +  │    escalate    ──► human handoff message
 │  keyword)    │    kb          ──► RAG pipeline
 └──────────────┘
       │ (kb)
       ▼
 ┌─────────────────────────────┐
 │ FAISS retrieval (top-k)     │
 │ over banking knowledge base │
 └─────────────────────────────┘
       │
       ▼
 ┌─────────────────────────────┐
 │ LLM answer synthesis        │  ← OpenAI (if key set) else extractive
 │ grounded in retrieved docs  │
 └─────────────────────────────┘
       │
       ▼
 ┌─────────────────────────────┐
 │ Hallucination Guard         │  semantic + token-overlap check
 │ • passes  → return answer   │
 │ • fails   → extractive      │
 │            fallback         │
 └─────────────────────────────┘
       │
       ▼
   response (answer + sources + telemetry)
```

---

## Project Layout

```
banking-rag-assistant/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI app
│   │   ├── rag_engine.py          # FAISS index + retrieval
│   │   ├── query_router.py        # smalltalk / scope / escalate / kb routing
│   │   ├── hallucination_guard.py # grounding + overlap checks
│   │   └── llm.py                 # OpenAI client + extractive fallback
│   ├── data/
│   │   └── banking_kb.json        # sample knowledge base (12 policies)
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api.js
    │   └── components/
    │       ├── Sidebar.jsx
    │       ├── Message.jsx
    │       ├── SourceCard.jsx
    │       └── RouteBadge.jsx
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.js
```

---

## Running

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# optional — enables LLM synthesis; otherwise uses extractive fallback
cp .env.example .env
# then edit .env and set OPENAI_API_KEY

uvicorn app.main:app --reload --port 8000
```

First start downloads the embedding model (~80 MB) and builds the FAISS index from `data/banking_kb.json`.

- Health check: <http://localhost:8000/health>
- Chat endpoint: `POST /chat` `{ "query": "...", "top_k": 4 }`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api/*` → `http://localhost:8000`.

---

## How the three core features work

### Retrieval-Augmented Generation
`RAGEngine` (`backend/app/rag_engine.py`) encodes each KB document with `all-MiniLM-L6-v2`, L2-normalizes the embeddings, and indexes them with `faiss.IndexFlatIP` (cosine similarity). At query time it returns the top-k passages with similarity scores.

### Intelligent Query Routing
`QueryRouter` (`backend/app/query_router.py`) classifies queries into four routes before any LLM call:
- `smalltalk` — greetings → canned response, no retrieval.
- `escalate`  — fraud / dispute keywords → human-handoff message.
- `out_of_scope` — low semantic similarity to banking anchors → polite refusal.
- `kb` — routes to RAG pipeline.

This keeps the LLM out of the loop for things it shouldn't answer (cost + safety).

### Hallucination Reduction
`HallucinationGuard` (`backend/app/hallucination_guard.py`) checks every generated answer with two cheap, deterministic gates:
1. **Semantic grounding** — cosine similarity between answer and concatenated source passages must exceed `0.45`.
2. **Token overlap** — content-word overlap between answer and sources must exceed `0.15`.

If either check fails, the system **discards the LLM answer** and returns a templated quote of the top retrieved passage — preventing fabricated policy from reaching the user. Telemetry (`grounded`, `grounding_score`, `overlap`, `route`, `latency_ms`) is returned with every response and rendered in the UI for transparency.

---

## Extending

- **Replace the KB** — drop a different JSON list of `{id, category, title, content}` into `backend/data/banking_kb.json`. The index rebuilds on start.
- **Persist the FAISS index** — currently rebuilt on startup. For large KBs, write `index.write_index()` to disk and reload it.
- **Swap the embedding model** — set `EMBED_MODEL` in `.env` to any sentence-transformers model.
- **Add streaming** — switch `/chat` to `StreamingResponse` and update the frontend to consume SSE.
- **Audit log** — persist every `(query, route, sources, grounded, answer)` tuple for compliance review.

---

## API Example

```bash
curl -X POST http://localhost:8000/chat \
  -H 'Content-Type: application/json' \
  -d '{"query": "what are home loan eligibility rules", "top_k": 3}'
```

Response:

```json
{
  "answer": "Home loans require...",
  "route": "kb",
  "confidence": 0.71,
  "grounded": true,
  "grounding_score": 0.83,
  "overlap": 0.42,
  "sources": [
    { "id": "loan-001", "title": "Home Loan Eligibility", "category": "loans",
      "snippet": "Home loan eligibility requires...", "score": 0.71 }
  ],
  "latency_ms": 184
}
```
# BFSI
