import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { TOPICS } from "../topics.js";
import { deleteDocument, listDocuments, uploadDocument } from "../api.js";

const ACCEPT = ".txt,.md,.markdown,.pdf,.json,.csv,.xlsx,.docx,.html,.htm";
const ACCEPT_RE = /\.(txt|md|markdown|pdf|json|csv|xlsx|docx|html?|markdown)$/i;
const ACCEPT_LABEL = "TXT · MD · PDF · JSON · CSV · XLSX · DOCX · HTML";
const MAX_MB = 10;

const FORMAT_META = {
  text: { label: "Text", color: "text-sky-300" },
  markdown: { label: "Markdown", color: "text-sky-300" },
  pdf: { label: "PDF", color: "text-rose-300" },
  json: { label: "JSON", color: "text-amber-300" },
  csv: { label: "CSV", color: "text-emerald-300" },
  excel: { label: "Excel", color: "text-emerald-300" },
  docx: { label: "DOCX", color: "text-indigo-300" },
  html: { label: "HTML", color: "text-fuchsia-300" },
};

const STRUCTURE_META = {
  structured: { label: "Structured", color: "border-emerald-400/30 text-emerald-300 bg-emerald-400/10" },
  unstructured: { label: "Unstructured", color: "border-sky-400/30 text-sky-300 bg-sky-400/10" },
  mixed: { label: "Mixed", color: "border-amber-400/30 text-amber-300 bg-amber-400/10" },
};

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

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

export default function UploadPanel({ onIngested }) {
  const [uploads, setUploads] = useState([]);
  const [stats, setStats] = useState(null);
  const [category, setCategory] = useState("uploaded");
  const [queue, setQueue] = useState([]); // [{file, progress, status, error}]
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const inputRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const data = await listDocuments();
      setUploads(data.uploads ?? []);
      setStats(data.stats ?? null);
      setListError(null);
    } catch (e) {
      setListError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const processFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []).filter((f) => {
        const ok = ACCEPT_RE.test(f.name);
        return ok && f.size <= MAX_MB * 1024 * 1024;
      });
      if (!files.length) return;

      const items = files.map((file) => ({
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        progress: 0,
        status: "uploading",
        error: null,
      }));
      setQueue((q) => [...items, ...q]);

      for (const item of items) {
        try {
          await uploadDocument(item.file, {
            category,
            onProgress: (p) =>
              setQueue((q) =>
                q.map((it) =>
                  it.key === item.key ? { ...it, progress: p } : it,
                ),
              ),
          });
          setQueue((q) =>
            q.map((it) =>
              it.key === item.key ? { ...it, progress: 1, status: "done" } : it,
            ),
          );
        } catch (e) {
          setQueue((q) =>
            q.map((it) =>
              it.key === item.key
                ? { ...it, status: "error", error: e.message }
                : it,
            ),
          );
        }
      }
      await refresh();
      onIngested?.();

      // Auto-dismiss finished items after a beat.
      setTimeout(() => {
        setQueue((q) => q.filter((it) => it.status === "uploading"));
      }, 2500);
    },
    [category, refresh, onIngested],
  );

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  }

  function onPick(e) {
    processFiles(e.target.files);
    e.target.value = "";
  }

  async function handleDelete(id) {
    if (!confirm("Delete this uploaded document and its embeddings?")) return;
    try {
      await deleteDocument(id);
      await refresh();
      onIngested?.();
    } catch (e) {
      setListError(e.message);
    }
  }

  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-white md:text-2xl">
            Upload your own knowledge
          </h2>
          <p className="mt-1 text-sm text-ink-400">
            Files are chunked & embedded on the server, then indexed for retrieval.
          </p>
        </div>
        {stats && (
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="chip">
              <Icon name="vault" className="h-3 w-3 text-brand-300" />
              {stats.kb_documents} KB docs
            </span>
            <span className="chip">
              <Icon name="file" className="h-3 w-3 text-brand-300" />
              {stats.uploaded_files} uploads · {stats.uploaded_chunks} chunks
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Dropzone */}
        <div className="lg:col-span-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed p-8 text-center transition ${
              dragOver
                ? "border-brand-400 bg-brand-500/10 shadow-glow"
                : "border-white/15 bg-white/[0.03] hover:border-brand-400/60 hover:bg-white/[0.05]"
            }`}
          >
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-500/20 blur-3xl" />
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={onPick}
            />
            <div className="relative mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-400/30 bg-ink-900/80 text-brand-300 shadow-glow">
              <Icon name="upload" className="h-6 w-6" />
            </div>
            <div className="relative mt-4 font-display text-base font-semibold text-white">
              Drop files here, or click to browse
            </div>
            <div className="relative mt-1 text-xs text-ink-400">
              {ACCEPT_LABEL} · up to {MAX_MB} MB per file
            </div>
            <div className="relative mt-3 flex flex-wrap items-center justify-center gap-1.5">
              {Object.entries(FORMAT_META).map(([key, meta]) => (
                <span
                  key={key}
                  className={`rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium ${meta.color}`}
                >
                  {meta.label}
                </span>
              ))}
            </div>

            <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2">
              <label
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-900/60 px-3 py-1.5 text-xs text-ink-200"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-ink-400">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-transparent text-white outline-none [&>option]:bg-ink-900"
                >
                  <option value="uploaded">Uploaded</option>
                  {TOPICS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-[11px] text-ink-500">
                Determines which topic-scoped search picks this up.
              </span>
            </div>
          </div>

          {/* Upload queue */}
          {queue.length > 0 && (
            <div className="mt-3 space-y-2">
              {queue.map((it) => (
                <div
                  key={it.key}
                  className="glass flex items-center gap-3 rounded-xl px-3 py-2"
                >
                  <div
                    className={`rounded-lg p-1.5 ${
                      it.status === "error"
                        ? "bg-rose-500/15 text-rose-300"
                        : it.status === "done"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-brand-500/15 text-brand-300"
                    }`}
                  >
                    <Icon
                      name={
                        it.status === "error"
                          ? "alert"
                          : it.status === "done"
                            ? "check"
                            : "loader"
                      }
                      className={`h-4 w-4 ${it.status === "uploading" ? "animate-spin" : ""}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate font-medium text-white">
                        {it.file.name}
                      </span>
                      <span className="shrink-0 text-ink-400">
                        {formatBytes(it.file.size)}
                      </span>
                    </div>
                    {it.status === "uploading" && (
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500 transition-all"
                          style={{ width: `${Math.round(it.progress * 100)}%` }}
                        />
                      </div>
                    )}
                    {it.status === "error" && (
                      <div className="mt-0.5 truncate text-[11px] text-rose-300">
                        {it.error}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Uploaded list */}
        <div className="lg:col-span-2">
          <div className="glass h-full rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-300">
                Indexed uploads
              </div>
              <button
                onClick={refresh}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-ink-200 hover:border-brand-400/40 hover:text-white"
              >
                Refresh
              </button>
            </div>

            {listError && (
              <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {listError}
              </div>
            )}

            <div className="scrollbar-thin mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {loading ? (
                <div className="text-xs text-ink-400">Loading…</div>
              ) : uploads.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-ink-400">
                  No uploads yet. Drop a file to get started.
                </div>
              ) : (
                uploads.map((u) => (
                  <div
                    key={u.id}
                    className="group flex items-start gap-3 rounded-xl border border-white/10 bg-ink-900/60 p-3"
                  >
                    <div className="rounded-lg bg-brand-500/10 p-1.5 text-brand-300">
                      <Icon name="file" className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white" title={u.filename}>
                        {u.filename}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] text-ink-300">
                        {u.format && FORMAT_META[u.format] && (
                          <span
                            className={`rounded-full bg-white/5 px-2 py-0.5 ${FORMAT_META[u.format].color}`}
                          >
                            {FORMAT_META[u.format].label}
                          </span>
                        )}
                        {u.structure && STRUCTURE_META[u.structure] && (
                          <span
                            className={`rounded-full border px-2 py-0.5 ${STRUCTURE_META[u.structure].color}`}
                          >
                            {STRUCTURE_META[u.structure].label}
                          </span>
                        )}
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-brand-300">
                          {u.category}
                        </span>
                        <span className="rounded-full bg-white/5 px-2 py-0.5">
                          {u.chunks} chunks
                        </span>
                        <span className="rounded-full bg-white/5 px-2 py-0.5">
                          {formatBytes(u.size_bytes)}
                        </span>
                        <span className="rounded-full bg-white/5 px-2 py-0.5">
                          {formatTime(u.uploaded_at)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="rounded-md border border-white/10 bg-white/5 p-1.5 text-ink-300 opacity-0 transition group-hover:opacity-100 hover:border-rose-400/40 hover:text-rose-300"
                      aria-label={`Delete ${u.filename}`}
                      title="Delete"
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
