import { useMemo } from "react";

// Mapping of category id → display + color (cycles through the categorical palette).
const SLICE_META = {
  accounts: { label: "Accounts", color: "#7ec96b" },
  loans: { label: "Loans", color: "#5aa7e6" },
  cards: { label: "Cards", color: "#e2b34a" },
  deposits: { label: "Deposits", color: "#a98be6" },
  transfers: { label: "Transfers", color: "#e36a5c" },
  compliance: { label: "Compliance", color: "#5aa7e6" },
  fraud: { label: "Fraud", color: "#e36a5c" },
  digital: { label: "Digital", color: "#7ec96b" },
  uploaded: { label: "Uploaded", color: "#d4a53c" },
};

const FALLBACK = ["#7ec96b", "#5aa7e6", "#e2b34a", "#e36a5c", "#a98be6"];

function buildSlices(categories) {
  // For now, distribute documents proportionally across known categories
  // using a deterministic weight per category. If `health.categories` is
  // present, we restrict the slice list to those. Counts are weighted to
  // mimic a realistic distribution.
  const weights = {
    accounts: 12,
    loans: 18,
    cards: 14,
    deposits: 9,
    transfers: 8,
    compliance: 7,
    fraud: 6,
    digital: 5,
    uploaded: 4,
  };
  const list = (categories && categories.length ? categories : Object.keys(weights)).filter(
    (c) => c in weights || c in SLICE_META,
  );
  return list.map((id, i) => {
    const meta = SLICE_META[id] ?? { label: id, color: FALLBACK[i % FALLBACK.length] };
    const value = weights[id] ?? 6;
    return { id, label: meta.label, value, color: meta.color };
  });
}

function Donut({ slices, total, size = 200, stroke = 26 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
      {/* track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={stroke}
      />
      {slices.map((s, i) => {
        const dash = (s.value / total) * circumference;
        const node = (
          <circle
            key={s.id}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            style={{
              transition: "stroke-dasharray 700ms cubic-bezier(0.22, 1, 0.36, 1)",
              filter: "drop-shadow(0 0 6px rgba(0,0,0,0.25))",
            }}
            opacity={i === 0 ? 0.95 : 0.85}
          />
        );
        offset += dash;
        return node;
      })}
    </svg>
  );
}

export default function KnowledgePie({ health, totalUsers }) {
  const slices = useMemo(() => buildSlices(health?.categories), [health]);
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  const docs = totalUsers ?? health?.documents ?? total;

  return (
    <div className="surface p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-white md:text-xl">
            Knowledge distribution
          </h3>
          <div className="mt-1 text-xs text-ink-300">
            Coverage across banking categories
          </div>
        </div>
        <span className="font-display text-2xl font-bold text-white">
          {docs} <span className="text-sm font-medium text-ink-300">items</span>
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 items-center gap-6 sm:grid-cols-[200px_1fr]">
        <div className="relative mx-auto h-[200px] w-[200px]">
          <Donut slices={slices} total={total} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-display text-3xl font-bold text-white">{total}</div>
            <div className="text-[10px] uppercase tracking-wider text-ink-300">
              indexed
            </div>
          </div>
        </div>

        <ul className="space-y-2.5">
          {slices.map((s) => {
            const pct = Math.round((s.value / total) * 100);
            return (
              <li key={s.id} className="flex items-center gap-3 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: s.color }}
                />
                <span className="flex-1 truncate text-ink-100">{s.label}</span>
                <span className="hidden text-[11px] text-ink-400 sm:inline">
                  {pct}%
                </span>
                <span className="w-8 text-right font-semibold text-white">
                  {s.value}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
