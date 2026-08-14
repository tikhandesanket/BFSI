// Lightweight client-side log of every question asked through the assistant,
// persisted in localStorage so it survives reloads. Used to export an
// .xlsx spreadsheet of "user queries asked" on demand (incl. voice commands).

import * as XLSX from "xlsx";

const KEY = "bra_query_log";

export function logQuery(entry) {
  if (!entry?.query) return;
  try {
    const log = getQueryLog();
    log.push({
      timestamp: new Date().toISOString(),
      source: entry.source || "chat",
      query: entry.query,
      route: entry.route ?? "",
      confidence: entry.confidence ?? "",
      grounded: entry.grounded ?? "",
      latency_ms: entry.latency_ms ?? "",
    });
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    /* ignore quota / serialization errors */
  }
}

export function getQueryLog() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearQueryLog() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// --- .xlsx building / download -----------------------------------------------

// Build a worksheet from row objects + ordered columns, then auto-size columns.
function sheetFrom(rows, columns) {
  const aoa = [
    columns.map((c) => c.label),
    ...rows.map((r) => columns.map((c) => r[c.key] ?? "")),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = columns.map((c) => ({
    wch: Math.min(
      60,
      Math.max(c.label.length, ...rows.map((r) => String(r[c.key] ?? "").length), 10),
    ),
  }));
  return ws;
}

const today = () => new Date().toISOString().slice(0, 10);
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8,
  sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};
const MONTH_RE = Object.keys(MONTHS).join("|");

// Parse a spoken/typed date range like "from 17 jun to 23 jun",
// "june 17 to june 23", "17/06 to 23/06" or "2026-06-17 to 2026-06-23".
// Returns { start: Date, end: Date } (inclusive, whole days) or null.
export function parseDateRange(text) {
  const t = (text || "").toLowerCase();
  const year = new Date().getFullYear();
  const found = [];

  const push = (re, build) => {
    for (const m of t.matchAll(re)) {
      const d = build(m);
      if (d && !Number.isNaN(d.getTime())) found.push({ idx: m.index, date: d });
    }
  };

  // DD <month> [YYYY]  — e.g. "17 jun", "17th june 2026"
  push(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?`, "g"),
    (m) => new Date(m[3] ? +m[3] : year, MONTHS[m[2]], +m[1]),
  );
  // <month> DD [YYYY]  — e.g. "june 17", "jun 17 2026"
  push(
    new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:[, ]+(\\d{4}))?`, "g"),
    (m) => new Date(m[3] ? +m[3] : year, MONTHS[m[1]], +m[2]),
  );
  // ISO YYYY-MM-DD
  push(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, (m) => new Date(+m[1], +m[2] - 1, +m[3]));
  // Numeric DD/MM[/YYYY] — day-first (matches the "17 jun" ordering users speak)
  push(/\b(\d{1,2})[/](\d{1,2})(?:[/](\d{2,4}))?\b/g, (m) => {
    const yr = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : year;
    return new Date(yr, +m[2] - 1, +m[1]);
  });

  if (!found.length) return null;
  // Keep spoken order, drop duplicates at the same position.
  const sorted = found.sort((a, b) => a.idx - b.idx).map((f) => f.date);
  let start = sorted[0];
  let end = sorted[1] ?? sorted[0]; // single date => that one day
  if (start > end) [start, end] = [end, start];

  start = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
  end = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
  return { start, end };
}

// Export the logged user queries to an .xlsx workbook. Optionally filtered to
// a { start, end } date range. Returns the number of rows written.
export function exportQueryLog(range) {
  let rows = getQueryLog();
  if (range?.start && range?.end) {
    rows = rows.filter((r) => {
      const ts = new Date(r.timestamp);
      return ts >= range.start && ts <= range.end;
    });
  }
  const columns = [
    { key: "timestamp", label: "Timestamp" },
    { key: "source", label: "Source" },
    { key: "query", label: "Query" },
    { key: "route", label: "Route" },
    { key: "confidence", label: "Confidence" },
    { key: "grounded", label: "Grounded" },
    { key: "latency_ms", label: "Latency (ms)" },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFrom(rows, columns), "User Queries");
  const suffix = range?.start
    ? `${ymd(range.start)}_to_${ymd(range.end)}`
    : today();
  XLSX.writeFile(wb, `user-queries-${suffix}.xlsx`);
  return rows.length;
}

// Export the bank dashboard / knowledge-base stats from the /health payload.
export function exportDashboard(health) {
  const stats = [
    { metric: "Status", value: health?.status ?? "unknown" },
    { metric: "Total documents", value: health?.documents ?? 0 },
    { metric: "KB documents", value: health?.kb_documents ?? 0 },
    { metric: "Uploaded files", value: health?.uploaded_files ?? 0 },
    { metric: "Uploaded chunks", value: health?.uploaded_chunks ?? 0 },
    { metric: "Generated at", value: new Date().toLocaleString() },
  ];
  const categories = (health?.categories ?? []).map((c) => ({ category: c }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(stats, [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Value" },
    ]),
    "Overview",
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(categories, [{ key: "category", label: "Category" }]),
    "Categories",
  );
  XLSX.writeFile(wb, `bank-dashboard-${today()}.xlsx`);
  return stats.length + categories.length;
}

// Decide whether a spoken/typed phrase is a download command, and for what.
// Returns "queries" | "dashboard" | null.
export function detectDownloadIntent(text) {
  const t = (text || "").toLowerCase();
  if (!/\b(download|export|save|generate)\b/.test(t)) return null;
  if (!/\b(sheet|csv|excel|spreadsheet|report|data|log|file|queries|query|questions?|history|dashboard|visits?)\b/.test(t))
    return null;
  if (/\b(dashboard|stats|statistics|overview|knowledge ?base|kb|bank data)\b/.test(t)) {
    return "dashboard";
  }
  if (/\b(quer|question|ask|history|visit|user)\b/.test(t)) {
    return "queries";
  }
  return "queries"; // sensible default for a bare "download the sheet"
}
