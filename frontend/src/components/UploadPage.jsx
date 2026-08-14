import BankGallery from "./BankGallery.jsx";
import Icon from "./Icon.jsx";
import UploadPanel from "./UploadPanel.jsx";
import { TOPICS, findTopic } from "../topics.js";

export default function UploadPage({
  onBack,
  onOpenTopic,
  onRefreshHealth,
  onToggleMobileNav,
}) {
  function openTopicId(id) {
    const t = findTopic(id) ?? TOPICS[0];
    onOpenTopic?.(t);
  }

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
              Upload documents
            </h1>
          </div>
        </div>

        <div id="upload" className="mt-6 scroll-mt-24">
          <UploadPanel onIngested={onRefreshHealth} />
        </div>

        <BankGallery onOpenTopic={openTopicId} />

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-6 text-[11px] text-ink-300">
          <span>Demo — for informational purposes only.</span>
          <span>Built with RAG · Query Routing · Hallucination Guard</span>
        </footer>
      </div>
    </div>
  );
}
