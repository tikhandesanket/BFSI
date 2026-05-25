import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import { TOPICS } from "../topics.js";
import { listDocuments } from "../api.js";

const SUGGESTED_TALKS = [
  {
    month: "ACC",
    day: "12",
    title: "Open a savings account",
    time: "Step-by-step · KYC",
    topic: "accounts",
  },
  {
    month: "LON",
    day: "08",
    title: "Home loan eligibility",
    time: "Income · LTV · rates",
    topic: "loans",
  },
];

const SUGGESTED_MEETINGS = [
  {
    month: "FD",
    day: "10",
    title: "Fixed deposit rates 2026",
    time: "Tenure · senior citizens",
    topic: "deposits",
  },
  {
    month: "NEF",
    day: "12",
    title: "NEFT vs RTGS vs IMPS",
    time: "Limits · timings · charges",
    topic: "transfers",
  },
];

const QUICK_PROMPTS = [
  {
    name: "Aarav S.",
    initials: "AS",
    color: "from-pie-blue to-pie-violet",
    line: "Asked: How do I block a stolen card?",
    topic: "cards",
  },
  {
    name: "Riya P.",
    initials: "RP",
    color: "from-pie-green to-brand-400",
    line: "Asked: When is KYC due?",
    topic: "compliance",
  },
  {
    name: "Vikram T.",
    initials: "VT",
    color: "from-pie-red to-brand-500",
    line: "Asked: Report fraudulent transaction",
    topic: "fraud",
  },
];

function formatTime(epoch) {
  if (!epoch) return "—";
  const d = new Date(epoch * 1000);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString();
}

function DateChip({ month, day }) {
  return (
    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-ink-900 text-center">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-brand-300">
        {month}
      </span>
      <span className="font-display text-base font-bold leading-none text-white">
        {day}
      </span>
    </div>
  );
}

function Section({ title, viewAllLabel = "View all", onViewAll, children }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-white">{title}</h3>
        <button
          onClick={onViewAll}
          className="text-[11px] font-medium text-brand-300 transition hover:text-brand-200"
        >
          {viewAllLabel}
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export default function ActivityColumn({ onOpenTopic }) {
  const [uploads, setUploads] = useState([]);

  useEffect(() => {
    listDocuments()
      .then((data) => setUploads((data.uploads ?? []).slice(0, 3)))
      .catch(() => setUploads([]));
  }, []);

  function pickTopic(id) {
    const t = TOPICS.find((x) => x.id === id) ?? TOPICS[0];
    onOpenTopic?.(t);
  }

  return (
    <aside className="surface flex flex-col gap-6 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-white">My activity</h2>
        <span className="chip-gold">
          <Icon name="sparkle" className="h-3 w-3" />
          Live
        </span>
      </div>

      {/* Suggested talks */}
      <Section title="Suggested topics" onViewAll={() => pickTopic(TOPICS[0].id)}>
        {SUGGESTED_TALKS.map((t) => (
          <button
            key={t.title}
            onClick={() => pickTopic(t.topic)}
            className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.05] bg-ink-900/40 p-2.5 text-left transition hover:border-brand-400/40 hover:bg-ink-900/70"
          >
            <DateChip month={t.month} day={t.day} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">
                {t.title}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-ink-300">{t.time}</div>
            </div>
            <Icon
              name="arrow"
              className="h-3.5 w-3.5 text-brand-300 transition group-hover:translate-x-0.5"
            />
          </button>
        ))}
      </Section>

      {/* Suggested meetings */}
      <Section title="Frequent questions" onViewAll={() => pickTopic("transfers")}>
        {SUGGESTED_MEETINGS.map((t) => (
          <button
            key={t.title}
            onClick={() => pickTopic(t.topic)}
            className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.05] bg-ink-900/40 p-2.5 text-left transition hover:border-brand-400/40 hover:bg-ink-900/70"
          >
            <DateChip month={t.month} day={t.day} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">
                {t.title}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-ink-300">{t.time}</div>
            </div>
            <Icon
              name="arrow"
              className="h-3.5 w-3.5 text-brand-300 transition group-hover:translate-x-0.5"
            />
          </button>
        ))}
      </Section>

      {/* Recent uploads OR quick prompts fallback */}
      <Section
        title={uploads.length ? "Recent uploads" : "Quick shoutouts"}
        viewAllLabel={uploads.length ? "Manage" : "View all"}
        onViewAll={() =>
          document.getElementById("upload")?.scrollIntoView({ behavior: "smooth" })
        }
      >
        {uploads.length > 0
          ? uploads.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-ink-900/40 p-2.5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-300 to-brand-500 text-[11px] font-bold text-ink-950">
                  <Icon name="file" className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white" title={u.filename}>
                    {u.filename}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-ink-300">
                    {u.chunks} chunks · {formatTime(u.uploaded_at)}
                  </div>
                </div>
              </div>
            ))
          : QUICK_PROMPTS.map((q) => (
              <button
                key={q.name}
                onClick={() => pickTopic(q.topic)}
                className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.05] bg-ink-900/40 p-2.5 text-left transition hover:border-brand-400/40 hover:bg-ink-900/70"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-ink-950 ${q.color}`}
                >
                  {q.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{q.name}</div>
                  <div className="mt-0.5 truncate text-[11px] text-ink-300">{q.line}</div>
                </div>
              </button>
            ))}
      </Section>
    </aside>
  );
}
