import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import {
  DigitalVaultArt,
  MobileBankingArt,
  SecureTransferArt,
  SkylineBankArt,
  SmartCardArt,
} from "./BankingArt.jsx";

const AUTOPLAY_MS = 5500;

function ImageSlide({ src, alt }) {
  return (
    <div className="absolute inset-0">
      <img src={src} alt={alt} className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-tr from-ink-950/85 via-ink-950/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 to-transparent" />
    </div>
  );
}

function ArtSlide({ Art, tint }) {
  return (
    <div className="absolute inset-0">
      <Art className="h-full w-full" />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(120deg, ${tint} 0%, rgba(2,6,23,0.6) 70%, transparent 100%)`,
        }}
      />
    </div>
  );
}

const SLIDES = [
  {
    eyebrow: "Trusted Banking Intelligence",
    title: "Your bank, ",
    titleAccent: "answered.",
    body:
      "Ask anything about accounts, loans, cards, deposits, KYC, transfers, or fraud — every answer cites the bank's own knowledge base.",
    ctaPrimary: "Start a conversation",
    ctaSecondary: "Browse topics",
    bg: <ImageSlide src="/Bank.In_.jpg" alt="Secure digital banking" />,
    accent: "from-brand-400/35 via-transparent to-transparent",
  },
  {
    eyebrow: "Vault-Grade Security",
    title: "Encrypted. ",
    titleAccent: "Compliant.",
    body:
      "End-to-end encrypted answers, RBI-compliant policies, and zero PII leakage. Built on a hardened RAG pipeline with hallucination guardrails.",
    ctaPrimary: "How it works",
    ctaSecondary: "Open assistant",
    bg: <ArtSlide Art={DigitalVaultArt} tint="rgba(8,145,178,0.45)" />,
    accent: "from-brand-400/30 via-transparent to-transparent",
  },
  {
    eyebrow: "Smart Cards & Payments",
    title: "Cards that ",
    titleAccent: "earn for you.",
    body:
      "Reward points, fuel waivers, dispute flows, and instant blocking — explore every card policy with crystal-clear citations.",
    ctaPrimary: "Cards FAQs",
    ctaSecondary: "Ask about cards",
    bg: <ArtSlide Art={SmartCardArt} tint="rgba(14,165,233,0.45)" />,
    accent: "from-brand-400/30 via-transparent to-transparent",
  },
  {
    eyebrow: "Banking On The Go",
    title: "Pay, save & invest ",
    titleAccent: "in seconds.",
    body:
      "NEFT, RTGS, IMPS, UPI — every transfer mode explained, with limits, charges, and zero-liability rules at your fingertips.",
    ctaPrimary: "Transfers guide",
    ctaSecondary: "Open assistant",
    bg: <ArtSlide Art={MobileBankingArt} tint="rgba(34,211,238,0.40)" />,
    accent: "from-brand-400/30 via-transparent to-transparent",
  },
  {
    eyebrow: "Connected Network",
    title: "Move money ",
    titleAccent: "safely.",
    body:
      "Real-time transfers across India's banking rails — with policy lookups that surface limits, timing, and dispute steps instantly.",
    ctaPrimary: "Learn more",
    ctaSecondary: "Ask the assistant",
    bg: <ArtSlide Art={SecureTransferArt} tint="rgba(14,165,233,0.42)" />,
    accent: "from-brand-400/30 via-transparent to-transparent",
  },
  {
    eyebrow: "Branch Network",
    title: "Always near, ",
    titleAccent: "always on.",
    body:
      "From flagship branches to digital channels — get instant answers about KYC renewal, account closure, branch hours and more.",
    ctaPrimary: "KYC & compliance",
    ctaSecondary: "Open assistant",
    bg: <ArtSlide Art={SkylineBankArt} tint="rgba(8,145,178,0.45)" />,
    accent: "from-brand-400/30 via-transparent to-transparent",
  },
];

export default function Carousel({ onPrimary, onSecondary }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef(null);

  const go = useCallback((next) => {
    setIdx((cur) => (next + SLIDES.length) % SLIDES.length);
  }, []);

  const next = useCallback(() => go(idx + 1), [go, idx]);
  const prev = useCallback(() => go(idx - 1), [go, idx]);

  useEffect(() => {
    if (paused) return undefined;
    timer.current = setTimeout(() => go(idx + 1), AUTOPLAY_MS);
    return () => clearTimeout(timer.current);
  }, [idx, paused, go]);

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/10 shadow-glow-lg"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      {/* Slides */}
      <div className="relative aspect-[16/9] md:aspect-[21/9] lg:aspect-[2.4/1]">
        {SLIDES.map((s, i) => {
          const active = i === idx;
          return (
            <div
              key={i}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                active ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              aria-hidden={!active}
            >
              {s.bg}
              <div
                className={`absolute inset-0 bg-gradient-to-r ${s.accent} mix-blend-screen`}
              />

              {/* Content */}
              <div className="relative z-10 flex h-full items-end md:items-center">
                <div className="w-full max-w-2xl p-6 md:p-10 lg:p-12">
                  <div
                    className={`inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-400/5 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-brand-300 transition-all duration-700 ${
                      active ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />
                    {s.eyebrow}
                  </div>
                  <h1
                    className={`mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-white transition-all duration-700 md:text-4xl lg:text-5xl ${
                      active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                    }`}
                  >
                    {s.title}
                    <span className="text-gradient-gold">{s.titleAccent}</span>
                  </h1>
                  <p
                    className={`mt-3 max-w-xl text-sm leading-relaxed text-ink-200 transition-all duration-700 md:text-base ${
                      active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                    }`}
                  >
                    {s.body}
                  </p>
                  <div
                    className={`mt-5 flex flex-wrap items-center gap-3 transition-all duration-700 ${
                      active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                    }`}
                  >
                    <button
                      onClick={() => onPrimary?.(i)}
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      <Icon name="bot" className="h-4 w-4" />
                      {s.ctaPrimary}
                    </button>
                    <button
                      onClick={() => onSecondary?.(i)}
                      className="btn-ghost inline-flex items-center gap-2"
                    >
                      <Icon name="sparkle" className="h-4 w-4 text-brand-300" />
                      {s.ctaSecondary}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Arrows */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-ink-900/70 p-2 text-white backdrop-blur transition hover:border-brand-400/50 hover:bg-ink-900/90"
        aria-label="Previous slide"
      >
        <Icon name="chevronLeft" className="h-4 w-4" />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-ink-900/70 p-2 text-white backdrop-blur transition hover:border-brand-400/50 hover:bg-ink-900/90"
        aria-label="Next slide"
      >
        <Icon name="chevronRight" className="h-4 w-4" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-ink-900/60 px-3 py-1.5 backdrop-blur">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === idx
                ? "w-6 bg-gradient-to-r from-brand-400 to-brand-300"
                : "w-1.5 bg-white/30 hover:bg-white/60"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
        <div
          key={`${idx}-${paused}`}
          className="h-full bg-gradient-to-r from-brand-400 to-brand-300"
          style={{
            animation: paused
              ? "none"
              : `cw-progress ${AUTOPLAY_MS}ms linear forwards`,
          }}
        />
      </div>

      <style>{`@keyframes cw-progress { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}
