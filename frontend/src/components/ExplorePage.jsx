import BankGallery from "./BankGallery.jsx";
import Icon from "./Icon.jsx";
import UploadPanel from "./UploadPanel.jsx";
import { TOPICS, findTopic } from "../topics.js";

export default function ExplorePage({
  onBack,
  onOpenTopic,
  onRefreshHealth,
  onToggleMobileNav,
}) {
  function openTopicId(id) {
    const t = findTopic(id) ?? TOPICS[0];
    onOpenTopic(t);
  }

  return (
    <div className="scrollbar-thin relative h-full overflow-y-auto">
      <div className="relative mx-auto max-w-[1200px] px-5 py-6 md:px-8 md:py-8">
        {/* Top bar with back button */}
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
              Explore
            </h1>
          </div>
        </div>

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
