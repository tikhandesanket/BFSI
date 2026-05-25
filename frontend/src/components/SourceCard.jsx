export default function SourceCard({ source }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-900/60 p-3 text-sm backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-white">{source.title}</div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-ink-300">
          score {source.score.toFixed(2)}
        </span>
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-brand-300">
        {source.category}
      </div>
      <p className="mt-2 text-xs leading-snug text-ink-300">{source.snippet}…</p>
    </div>
  );
}
