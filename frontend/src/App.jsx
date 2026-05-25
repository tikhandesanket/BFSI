import { useEffect, useRef, useState } from "react";
import Message from "./components/Message.jsx";
import Sidebar from "./components/Sidebar.jsx";
import { fetchHealth, sendChat } from "./api.js";

const INITIAL_MSG = {
  role: "assistant",
  content:
    "Hi! I'm your banking knowledge assistant. Ask about accounts, loans, cards, deposits, KYC, transfers, or fraud reporting.",
  meta: null,
  sources: [],
};

export default function App() {
  const [messages, setMessages] = useState([INITIAL_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function submit(text) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setLoading(true);
    try {
      const data = await sendChat(q);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
          meta: {
            route: data.route,
            confidence: data.confidence,
            grounded: data.grounded,
            grounding_score: data.grounding_score,
            overlap: data.overlap,
            latency_ms: data.latency_ms,
          },
        },
      ]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex h-full">
      <Sidebar health={health} onPick={(q) => submit(q)} />

      <main className="flex-1 flex flex-col">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-900">Banking Knowledge Assistant</h1>
          <p className="text-xs text-slate-500">
            Retrieval-Augmented Generation with hallucination guardrails
          </p>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
          {messages.map((m, i) => (
            <Message key={i} msg={m} />
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 shadow-sm text-sm text-slate-500">
                Searching the knowledge base
                <span className="inline-block animate-pulse">…</span>
              </div>
            </div>
          )}
          {error && (
            <div className="text-sm text-rose-600 text-center">Error: {error}</div>
          )}
        </div>

        <footer className="border-t border-slate-200 bg-white p-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              placeholder="Ask a banking question…"
              className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={() => submit()}
              disabled={loading || !input.trim()}
              className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
          <div className="mt-2 text-center text-[11px] text-slate-400">
            This assistant only answers from the bank's internal knowledge base.
          </div>
        </footer>
      </main>
    </div>
  );
}
