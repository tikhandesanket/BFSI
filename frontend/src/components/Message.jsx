import RouteBadge from "./RouteBadge.jsx";
import SourceCard from "./SourceCard.jsx";

function Meta({ msg }) {
  if (msg.role !== "assistant" || !msg.meta) return null;
  const { route, grounded, grounding_score, overlap, latency_ms, confidence } = msg.meta;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <RouteBadge route={route} />
      <span
        className={
          grounded
            ? "inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700"
            : "inline-block rounded-full bg-rose-50 px-2 py-0.5 text-rose-700"
        }
      >
        {grounded ? "Grounded" : "Fallback used"} · g={grounding_score?.toFixed(2)} ·
        o={overlap?.toFixed(2)}
      </span>
      <span>conf {Number(confidence ?? 0).toFixed(2)}</span>
      <span>{latency_ms} ms</span>
    </div>
  );
}

export default function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm whitespace-pre-wrap leading-relaxed
          ${isUser ? "bg-brand-600 text-white" : "bg-white border border-slate-200 text-slate-800"}`}
      >
        <div>{msg.content}</div>
        <Meta msg={msg} />
        {msg.role === "assistant" && msg.sources?.length > 0 && (
          <div className="mt-3 grid gap-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
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
