import Icon from "./Icon.jsx";
import { TOPICS } from "../topics.js";

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

export default function TopicsPage({ onBack, onOpenTopic, onToggleMobileNav }) {
  return (
    <div className="scrollbar-thin relative h-full overflow-y-auto">
      <div className="relative mx-auto max-w-[1200px] px-5 py-6 md:px-8 md:py-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleMobileNav}
              className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-ink-100 transition hover:border-brand-400/40 hover:text-white lg:hidden"
              aria-label="Open menu"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-ink-100 transition hover:border-brand-400/40 hover:text-white"
              aria-label="Back to dashboard"
            >
              <Icon name="chevronLeft" className="h-4 w-4" />
              Back
            </button>
            <h1 className="font-display text-2xl font-bold text-white md:text-3xl">
              Explore by topic
            </h1>
          </div>
          <span className="hidden text-xs text-ink-300 md:block">
            {TOPICS.length} topics
          </span>
        </div>

        <p className="mt-3 text-sm text-ink-300">
          Pick a topic — the assistant will open scoped to that domain.
        </p>

        <section id="topics" className="mt-6 scroll-mt-24">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {TOPICS.map((t) => (
              <TopicCard key={t.id} topic={t} onOpen={onOpenTopic} />
            ))}
          </div>
        </section>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-6 text-[11px] text-ink-300">
          <span>Demo — for informational purposes only.</span>
          <span>Built with RAG · Query Routing · Hallucination Guard</span>
        </footer>
      </div>
    </div>
  );
}
