import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import Message from "./Message.jsx";
import { sendChat } from "../api.js";

function greetingFor(topic) {
  if (!topic) {
    return "Hi! I'm your banking knowledge assistant. Ask about accounts, loans, cards, deposits, KYC, transfers or fraud reporting.";
  }
  return `You're exploring **${topic.label}** — ${topic.tagline.toLowerCase()}. Ask away, or pick a suggested question below.`;
}

export default function ChatPanel({ open, topic, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Reset thread whenever the panel opens or the topic changes.
  useEffect(() => {
    if (!open) return;
    setMessages([
      {
        role: "assistant",
        content: greetingFor(topic),
        meta: null,
        sources: [],
      },
    ]);
    setError(null);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 200);
  }, [open, topic?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  // Lock body scroll when the panel is open on small screens.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-ink-950/70 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-ink-900/80 shadow-glow-lg backdrop-blur-2xl transition-transform duration-300 ease-out sm:max-w-lg ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Banking Assistant Chat"
      >
        {/* Header */}
        <header className="relative border-b border-white/10 bg-gradient-to-b from-brand-500/10 to-transparent px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-brand-400/40 blur-md" />
                <div className="relative rounded-xl border border-brand-400/40 bg-ink-900 p-2 text-brand-300 shadow-glow">
                  <Icon name="bot" className="h-5 w-5" />
                </div>
              </div>
              <div>
                <div className="font-display text-sm font-semibold text-white">
                  Banking Assistant
                </div>
                <div className="mt-0.5 text-[11px] text-ink-300">
                  {topic ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-400 shadow-[0_0_8px_theme(colors.brand.400)]" />
                      Topic: <span className="font-medium text-brand-300">{topic.label}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Ready · grounded answers
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-ink-200 transition hover:border-brand-400/40 hover:text-white"
              aria-label="Close chat"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="scrollbar-thin flex-1 overflow-y-auto px-4 py-5 space-y-4"
        >
          {messages.map((m, i) => (
            <Message key={i} msg={m} />
          ))}

          {/* Topic suggestion chips (only at start) */}
          {messages.length === 1 && topic && (
            <div className="pt-1">
              <div className="mb-2 text-[11px] uppercase tracking-wider text-ink-400">
                Suggested for {topic.label}
              </div>
              <div className="flex flex-wrap gap-2">
                {topic.samples.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-ink-100 transition hover:border-brand-400/50 hover:bg-brand-500/10 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink-200">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-300 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-300 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-300" />
                </span>
                Searching knowledge base
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}
        </div>

        {/* Composer */}
        <footer className="border-t border-white/10 bg-ink-900/60 p-3">
          <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-ink-800/80 p-2 focus-within:border-brand-400/50 focus-within:shadow-glow">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              placeholder={
                topic
                  ? `Ask about ${topic.label.toLowerCase()}…`
                  : "Ask a banking question…"
              }
              className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white placeholder-ink-400 focus:outline-none"
            />
            <button
              onClick={() => submit()}
              disabled={loading || !input.trim()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-500 text-ink-950 shadow-glow transition hover:shadow-glow-lg disabled:opacity-40 disabled:shadow-none"
              aria-label="Send"
            >
              <Icon name="send_msg" className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 text-center text-[10px] text-ink-400">
            Answers are drawn only from the bank's internal knowledge base.
          </div>
        </footer>
      </aside>
    </>
  );
}
