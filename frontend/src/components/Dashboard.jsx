import ActivityColumn from "./ActivityColumn.jsx";
import Icon from "./Icon.jsx";
import KnowledgePie from "./KnowledgePie.jsx";
import WelcomeBanner from "./WelcomeBanner.jsx";
import { TOPICS, findTopic } from "../topics.js";

function MiniStat({ label, value, icon, tint = "bg-brand-400/15 text-brand-300" }) {
  return (
    <div className="stat-card-light flex items-center gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="font-display text-xl font-bold leading-none text-white">
          {value}
        </div>
        <div className="mt-1 text-[11px] text-ink-300">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard({
  health,
  onOpenTopic,
  onAskFree,
  onGoToExplore,
  onToggleMobileNav,
}) {
  const docs = health?.documents ?? 0;
  const cats = health?.categories?.length ?? TOPICS.length;
  const uploads = health?.uploaded_files ?? 0;
  const chunks = health?.uploaded_chunks ?? 0;

  function openTopicId(id) {
    const t = findTopic(id) ?? TOPICS[0];
    onOpenTopic(t);
  }

  return (
    <div className="scrollbar-thin relative h-full overflow-y-auto">
      <div className="relative mx-auto max-w-[1200px] px-5 py-6 md:px-8 md:py-8">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleMobileNav}
              className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-ink-100 transition hover:border-brand-400/40 hover:text-white lg:hidden"
              aria-label="Open menu"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <h1 className="font-display text-2xl font-bold text-white md:text-3xl">
              Secure Banking for a Smarter Future
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="chip">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  health
                    ? "bg-emerald-400 shadow-[0_0_8px_theme(colors.emerald.400)]"
                    : "bg-rose-400"
                }`}
              />
              {health ? "Service Online" : "Service Offline"}
            </span>
            <span className="chip hidden md:inline-flex">
              <Icon name="sparkle" className="h-3 w-3 text-brand-300" />
              RAG · Guardrails
            </span>
            <button
              onClick={onGoToExplore}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-400/40 bg-brand-400/10 px-3 py-1.5 text-xs font-medium text-brand-300 transition hover:bg-brand-400/20 hover:text-white"
            >
              Explore
              <Icon name="arrow" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Main + Activity */}
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* MAIN COLUMN */}
          <div className="space-y-5 lg:col-span-2">
            <section id="overview" className="scroll-mt-24">
              <WelcomeBanner
                health={health}
                onAskFree={onAskFree}
                onOpenTopic={() => openTopicId("accounts")}
              />
            </section>

            {/* Stats row */}
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MiniStat
                label="Categories"
                value={cats}
                icon="grid"
                tint="bg-pie-green/15 text-pie-green"
              />
              <MiniStat
                label="KB docs"
                value={docs}
                icon="book"
                tint="bg-pie-blue/15 text-pie-blue"
              />
              <MiniStat
                label="Chunks"
                value={chunks}
                icon="file"
                tint="bg-brand-400/15 text-brand-300"
              />
              <MiniStat
                label="Uploads"
                value={uploads}
                icon="upload"
                tint="bg-pie-red/15 text-pie-red"
              />
            </section>

            {/* Pie chart */}
            <section>
              <KnowledgePie health={health} totalUsers={docs} />
            </section>
          </div>

          {/* ACTIVITY COLUMN */}
          <div className="lg:col-span-1">
            <ActivityColumn onOpenTopic={onOpenTopic} />
          </div>
        </div>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-6 text-[11px] text-ink-300">
          <span>Demo — for informational purposes only.</span>
          <span>Built with RAG · Query Routing · Hallucination Guard</span>
        </footer>
      </div>
    </div>
  );
}
