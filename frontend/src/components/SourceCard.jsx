export default function SourceCard({ source }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-slate-800">{source.title}</div>
        <span className="text-xs text-slate-500">score {source.score.toFixed(2)}</span>
      </div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-brand-600">
        {source.category}
      </div>
      <p className="mt-2 text-slate-600 leading-snug">{source.snippet}…</p>
    </div>
  );
}
