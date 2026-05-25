import ActivityColumn from "./ActivityColumn.jsx";
import BankGallery from "./BankGallery.jsx";
import Icon from "./Icon.jsx";
import KnowledgePie from "./KnowledgePie.jsx";
import UploadPanel from "./UploadPanel.jsx";
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

function TopicCard({ topic, onOpen }) {
  return (
    <button
      onClick={() => onOpen(topic)}
      className="topic-card group text-left"
    >
      <div className="relative z-10 flex items-start justify-between">
        <div className="rounded-xl border border-brand-400/30 bg-brand-400/10 p-2.5 text-brand-300 transition group-hover:bg-brand-400/20">
          <Icon name={topic.icon} className="h-5 w-5" />
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-300">
          Topic
        </span>
      </div>
      <div className="relative z-10 mt-4">
        <div className="font-display text-lg font-semibold text-white">
          {topic.label}
        </div>
        <div className="mt-1 text-xs text-ink-300">{topic.tagline}</div>
      </div>
      <div className="relative z-10 mt-5 flex items-center gap-1.5 text-xs font-medium text-brand-300 opacity-80 transition group-hover:opacity-100">
        Ask the assistant
        <Icon name="arrow" className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

export default function Dashboard({
  health,
  onOpenTopic,
  onAskFree,
  onRefreshHealth,
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
              Dashboard
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

        {/* Topics */}
        <section id="topics" className="mt-10 scroll-mt-24">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-white md:text-2xl">
                Explore by topic
              </h2>
              <p className="mt-1 text-sm text-ink-300">
                Pick a topic — the assistant will open scoped to that domain.
              </p>
            </div>
            <span className="hidden text-xs text-ink-300 md:block">
              {TOPICS.length} topics
            </span>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TOPICS.map((t) => (
              <TopicCard key={t.id} topic={t} onOpen={onOpenTopic} />
            ))}
          </div>
        </section>

        {/* Banking imagery gallery */}
        <BankGallery onOpenTopic={openTopicId} />

        {/* Upload documents */}
        <div id="upload" className="scroll-mt-24">
          <UploadPanel onIngested={onRefreshHealth} />
        </div>

        {/* Feature strip */}
        <section
          id="sources"
          className="mt-12 scroll-mt-24 grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          {[
            {
              icon: "shield",
              title: "Grounded answers",
              body: "Every response is checked against the source corpus before it reaches you.",
            },
            {
              icon: "sparkle",
              title: "Smart routing",
              body: "Queries are routed to the knowledge base, small-talk, or escalation.",
            },
            {
              icon: "lock",
              title: "Secure by design",
              body: "No PII leaves the bank's perimeter. Sources are always cited.",
            },
          ].map((f) => (
            <div key={f.title} className="surface p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-brand-400/15 p-2 text-brand-300">
                  <Icon name={f.icon} className="h-5 w-5" />
                </div>
                <div className="font-display text-base font-semibold text-white">
                  {f.title}
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-200">{f.body}</p>
            </div>
          ))}
        </section>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-6 text-[11px] text-ink-300">
          <span>Demo — for informational purposes only.</span>
          <span>Built with RAG · Query Routing · Hallucination Guard</span>
        </footer>
      </div>
    </div>
  );
}
