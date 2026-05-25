const STYLES = {
  kb: "bg-emerald-100 text-emerald-700",
  smalltalk: "bg-sky-100 text-sky-700",
  out_of_scope: "bg-amber-100 text-amber-700",
  escalate: "bg-rose-100 text-rose-700",
};

const LABELS = {
  kb: "Knowledge Base",
  smalltalk: "Small Talk",
  out_of_scope: "Out of Scope",
  escalate: "Escalated",
};

export default function RouteBadge({ route }) {
  if (!route) return null;
  const cls = STYLES[route] ?? "bg-slate-100 text-slate-700";
  const label = LABELS[route] ?? route;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
