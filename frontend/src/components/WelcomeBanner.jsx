import Icon from "./Icon.jsx";

export default function WelcomeBanner({ health, onAskFree, onOpenTopic }) {
  const docs = health?.documents ?? 0;
  const uploads = health?.uploaded_files ?? 0;
  const completion = Math.min(95, 25 + Math.min(70, uploads * 10));

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-300 via-brand-400 to-brand-500 p-5 md:p-7 shadow-glow">
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-32 h-40 w-40 rounded-full bg-brand-200/40 blur-3xl" />

      <div className="relative flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-bold leading-tight text-ink-950 md:text-3xl">
            Welcome back, Banker
          </h2>
          <p className="mt-1 max-w-xl text-sm text-ink-900/80">
            Your knowledge base is {completion}% set up. Ask anything, or add more
            docs to make the assistant smarter.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={onAskFree}
              className="btn-dark inline-flex items-center gap-2"
            >
              <Icon name="bot" className="h-4 w-4 text-brand-400" />
              Ask the assistant
            </button>
            <button
              onClick={onOpenTopic}
              className="inline-flex items-center gap-2 rounded-xl border border-ink-950/30 bg-white/60 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-white/80"
            >
              <Icon name="grid" className="h-4 w-4" />
              Browse topics
            </button>
          </div>

          {/* progress bar */}
          <div className="mt-4 max-w-md">
            <div className="flex items-center justify-between text-[11px] font-medium text-ink-900/80">
              <span>Setup progress</span>
              <span>{completion}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-950/15">
              <div
                className="h-full rounded-full bg-ink-950"
                style={{ width: `${completion}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[10px] text-ink-900/70">
              <span>{docs} KB documents</span>
              <span>·</span>
              <span>{uploads} uploaded files</span>
            </div>
          </div>
        </div>

        {/* avatar / hero image */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-full bg-white/20 blur-2xl" />
          <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-white/70 shadow-glow-lg md:h-32 md:w-32">
            <img
              src="/Bank.In_.jpg"
              alt="Banking visual"
              className="h-full w-full object-cover"
            />
          </div>
          <span className="absolute -bottom-1 right-1 inline-flex items-center gap-1 rounded-full border border-ink-950/15 bg-ink-950 px-2 py-0.5 text-[10px] font-semibold text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Online
          </span>
        </div>
      </div>
    </div>
  );
}
