import Icon from "./Icon.jsx";
import {
  DigitalVaultArt,
  GrowthInvestArt,
  MobileBankingArt,
  SecureTransferArt,
  SkylineBankArt,
  SmartCardArt,
} from "./BankingArt.jsx";

const TILES = [
  {
    title: "Vault & Deposits",
    body: "Fixed deposits, RD, senior-citizen perks.",
    Art: DigitalVaultArt,
    topic: "deposits",
    span: "md:col-span-2 md:row-span-2",
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
    span: "md:col-span-2",
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
  return (
    <section id="gallery" className="mt-14 scroll-mt-24">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-white md:text-2xl">
            A glimpse of banking with us
          </h2>
          <p className="mt-1 text-sm text-ink-400">
            Visuals from across our digital experience — click any tile to ask about it.
          </p>
        </div>
        <span className="hidden text-xs text-ink-400 md:block">
          {TILES.length} visuals
        </span>
      </div>

      <div className="mt-6 grid auto-rows-[180px] grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        {TILES.map((tile, i) => (
          <button
            key={i}
            onClick={() => onOpenTopic?.(tile.topic)}
            className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-ink-900/60 text-left transition-all duration-300 hover:-translate-y-1 hover:border-brand-400/50 hover:shadow-glow ${tile.span || ""}`}
          >
            <div className="absolute inset-0">
              <tile.Art className="h-full w-full" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-brand-500/0 transition group-hover:to-brand-500/20" />

            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="font-display text-sm font-semibold text-white md:text-base">
                {tile.title}
              </div>
              <div className="mt-1 line-clamp-1 text-xs text-ink-300">{tile.body}</div>
            </div>

            <div className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-ink-900/70 text-brand-300 opacity-0 backdrop-blur transition group-hover:opacity-100">
              <Icon name="arrow" className="h-3.5 w-3.5" />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
