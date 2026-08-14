import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import {
  DigitalVaultArt,
  GrowthInvestArt,
  MobileBankingArt,
  SecureTransferArt,
  SkylineBankArt,
  SmartCardArt,
} from "./BankingArt.jsx";

const AUTOPLAY_MS = 4500;

const TILES = [
  {
    title: "Vault & Deposits",
    body: "Fixed deposits, RD, senior-citizen perks.",
    Art: DigitalVaultArt,
    topic: "deposits",
  },
  {
    title: "Premium Cards",
    body: "Rewards, waivers, fraud cover.",
    Art: SmartCardArt,
    topic: "cards",
  },
  {
    title: "Mobile Banking",
    body: "Pay, save & track in one tap.",
    Art: MobileBankingArt,
    topic: "digital",
  },
  {
    title: "Branch Network",
    body: "Find help, anywhere in India.",
    Art: SkylineBankArt,
    topic: "accounts",
  },
  {
    title: "Secure Transfers",
    body: "NEFT · RTGS · IMPS · UPI.",
    Art: SecureTransferArt,
    topic: "transfers",
  },
  {
    title: "Smart Investments",
    body: "Grow your wealth confidently.",
    Art: GrowthInvestArt,
    topic: "deposits",
  },
];

export default function BankGallery({ onOpenTopic }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef(null);

  const go = useCallback((next) => {
    setIdx((cur) => (next + TILES.length) % TILES.length);
  }, []);

  const next = useCallback(() => go(idx + 1), [go, idx]);
  const prev = useCallback(() => go(idx - 1), [go, idx]);

  useEffect(() => {
    if (paused) return undefined;
    timer.current = setTimeout(() => go(idx + 1), AUTOPLAY_MS);
    return () => clearTimeout(timer.current);
  }, [idx, paused, go]);

  return (
    <section id="gallery" className="mt-14 scroll-mt-24">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-white md:text-2xl">
            A glimpse of banking with us
          </h2>
          <p className="mt-1 text-sm text-ink-400">
            Visuals from across our digital experience — click the tile to ask about it.
          </p>
        </div>
        <span className="hidden text-xs text-ink-400 md:block">
          {idx + 1} / {TILES.length}
        </span>
      </div>

      <div
        className="relative mt-6 overflow-hidden rounded-3xl border border-white/10 shadow-glow-lg"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        aria-roledescription="carousel"
      >
        <div className="relative aspect-[16/9] md:aspect-[21/9] lg:aspect-[2.4/1]">
          {TILES.map((tile, i) => {
            const active = i === idx;
            const Art = tile.Art;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onOpenTopic?.(tile.topic)}
                tabIndex={active ? 0 : -1}
                aria-hidden={!active}
                className={`absolute inset-0 w-full text-left transition-opacity duration-700 ease-out ${
                  active ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                <div className="absolute inset-0">
                  <Art className="h-full w-full" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-tr from-ink-950/85 via-ink-950/55 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950 to-transparent" />

                <div className="relative z-10 flex h-full items-end md:items-center">
                  <div className="w-full max-w-xl p-6 md:p-10 lg:p-12">
                    <div
                      className={`inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-400/5 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-brand-300 transition-all duration-700 ${
                        active ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />
                      Glimpse {i + 1}
                    </div>
                    <h3
                      className={`mt-3 font-display text-2xl font-bold leading-tight text-white transition-all duration-700 md:text-3xl lg:text-4xl ${
                        active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                      }`}
                    >
                      {tile.title}
                    </h3>
                    <p
                      className={`mt-2 max-w-md text-sm leading-relaxed text-ink-200 transition-all duration-700 md:text-base ${
                        active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                      }`}
                    >
                      {tile.body}
                    </p>
                    <div
                      className={`mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-brand-300 transition-all duration-700 ${
                        active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                      }`}
                    >
                      Ask about this
                      <Icon name="arrow" className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-ink-900/70 p-2 text-white backdrop-blur transition hover:border-brand-400/50 hover:bg-ink-900/90"
          aria-label="Previous slide"
        >
          <Icon name="chevronLeft" className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-ink-900/70 p-2 text-white backdrop-blur transition hover:border-brand-400/50 hover:bg-ink-900/90"
          aria-label="Next slide"
        >
          <Icon name="chevronRight" className="h-4 w-4" />
        </button>

        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-ink-900/60 px-3 py-1.5 backdrop-blur">
          {TILES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(i);
              }}
              className={`h-1.5 rounded-full transition-all ${
                i === idx
                  ? "w-6 bg-gradient-to-r from-brand-400 to-brand-300"
                  : "w-1.5 bg-white/30 hover:bg-white/60"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
          <div
            key={`${idx}-${paused}`}
            className="h-full bg-gradient-to-r from-brand-400 to-brand-300"
            style={{
              animation: paused
                ? "none"
                : `bg-progress ${AUTOPLAY_MS}ms linear forwards`,
            }}
          />
        </div>

        <style>{`@keyframes bg-progress { from { width: 0% } to { width: 100% } }`}</style>
      </div>
    </section>
  );
}
