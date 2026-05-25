import RouteBadge from "./RouteBadge.jsx";
import SourceCard from "./SourceCard.jsx";

function Meta({ msg }) {
  if (msg.role !== "assistant" || !msg.meta) return null;
  const { route, grounded, grounding_score, overlap, latency_ms, confidence } = msg.meta;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-300">
      <RouteBadge route={route} />
      <span
        className={
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 " +
          (grounded
            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
            : "border-rose-400/30 bg-rose-400/10 text-rose-300")
        }
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            grounded ? "bg-emerald-400" : "bg-rose-400"
          }`}
        />
        {grounded ? "Grounded" : "Fallback"} · g={Number(grounding_score ?? 0).toFixed(2)} ·
        o={Number(overlap ?? 0).toFixed(2)}
      </span>
      <span className="chip">conf {Number(confidence ?? 0).toFixed(2)}</span>
      <span className="chip">{latency_ms} ms</span>
    </div>
  );
}

export default function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          "max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-card " +
          (isUser
            ? "bg-gradient-to-br from-brand-400 to-brand-500 text-ink-950 shadow-glow"
            : "border border-white/10 bg-white/[0.04] text-ink-100 backdrop-blur-xl")
        }
      >
        <div>{msg.content}</div>
        <Meta msg={msg} />
        {msg.role === "assistant" && msg.sources?.length > 0 && (
          <div className="mt-3 grid gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Sources
            </div>
            {msg.sources.map((s) => (
              <SourceCard key={s.id} source={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
