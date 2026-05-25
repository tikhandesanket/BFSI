const STYLES = {
  kb: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  smalltalk: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  out_of_scope: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  escalate: "border-rose-400/30 bg-rose-400/10 text-rose-300",
};

const LABELS = {
  kb: "Knowledge Base",
  smalltalk: "Small Talk",
  out_of_scope: "Out of Scope",
  escalate: "Escalated",
};

export default function RouteBadge({ route }) {
  if (!route) return null;
  const cls = STYLES[route] ?? "border-white/10 bg-white/5 text-ink-200";
  const label = LABELS[route] ?? route;
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {label}
    </span>
  );
}
