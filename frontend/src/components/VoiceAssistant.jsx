import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { sendChat } from "../api.js";
import {
  logQuery,
  detectDownloadIntent,
  parseDateRange,
  exportQueryLog,
  exportDashboard,
} from "../queryLog.js";

const fmtDate = (d) =>
  d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// Web Speech API is vendor-prefixed in some browsers.
const SpeechRecognition =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

const STATUS_LABEL = {
  idle: "Tap the mic and ask a banking question",
  listening: "Listening…",
  thinking: "Searching the knowledge base…",
  speaking: "Speaking the answer",
};

// Short words that signal the user wants to cut in while the assistant talks.
const INTERRUPT_WORDS = [
  "stop", "wait", "hold on", "cancel", "hey", "hello", "excuse me", "pause",
  "okay stop", "actually",
];

// True if `text` contains an interrupt word that isn't part of the spoken
// answer (so the mic hearing the assistant's own voice doesn't self-trigger).
function hasInterruptWord(text, answerText) {
  const t = ` ${text.toLowerCase()} `;
  const a = (answerText || "").toLowerCase();
  return INTERRUPT_WORDS.some(
    (w) => t.includes(` ${w} `) && !a.includes(w),
  );
}

// --- Natural speech ------------------------------------------------------
// The Web Speech API has no SSML support, so fillers are inserted as plain
// text and pauses come from punctuation: a comma is a short pause, a period a
// longer one. This only shapes the spoken audio — the on-screen answer is
// left untouched. Set NATURAL_SPEECH to false to disable.
const NATURAL_SPEECH = true;

// Conversational lead-ins spoken before the answer.
const LEAD_INS = [
  "Umm, okay, so,",
  "Well,",
  "Right, so,",
  "Okay, umm,",
  "Hmm, let me see,",
];

// Soft fillers dropped in after the first sentence break.
const MID_FILLERS = ["um,", "you know,", "so,", "well,"];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Add conversational fillers + comma pauses so the TTS voice sounds less
// robotic. Returns the original text unchanged when NATURAL_SPEECH is off.
function humanizeForSpeech(text) {
  if (!NATURAL_SPEECH || !text) return text;
  let out = text.trim();
  // Insert a soft filler right after the first sentence-ending punctuation.
  const m = out.match(/[.!?]\s+/);
  if (m) {
    const i = m.index + m[0].length;
    out = `${out.slice(0, i)}${pick(MID_FILLERS)} ${out.slice(i)}`;
  }
  return `${pick(LEAD_INS)} ${out}`;
}

export default function VoiceAssistant({ open, onClose, health }) {
  const [status, setStatus] = useState("idle"); // idle | listening | thinking | speaking
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [muted, setMuted] = useState(false);
  const [handsFree, setHandsFree] = useState(true); // auto-interrupt while speaking

  const recognitionRef = useRef(null);
  const finalRef = useRef("");
  const abortRef = useRef(null); // AbortController for the in-flight /chat request
  const reqIdRef = useRef(0); // token to drop responses from interrupted requests
  // Recognition phase: "idle" | "listening" (capture a query) | "monitoring"
  // (passively listen for a spoken interruption) | "switching" (restart pending).
  const phaseRef = useRef("idle");
  const pendingListenRef = useRef(false);
  const answerTextRef = useRef(""); // text currently being spoken, for echo filtering

  const supported = Boolean(SpeechRecognition);

  // Cancel anything in progress: stop TTS and abort an in-flight query so a new
  // question can take over (barge-in / interruption).
  const cancelActive = useCallback(() => {
    window.speechSynthesis?.cancel();
    reqIdRef.current += 1; // invalidate any pending response
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  // Start / restart the recognizer in a given phase, coping with the fact that
  // SpeechRecognition.start() throws if it's already running (we stop & retry
  // via the onend handler, which honours pendingListenRef).
  const controlStart = useCallback((phase) => {
    const rec = recognitionRef.current;
    if (!rec) return;
    finalRef.current = "";
    rec.continuous = phase === "monitoring";
    try {
      phaseRef.current = phase;
      rec.start();
    } catch {
      phaseRef.current = "switching";
      pendingListenRef.current = phase;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const speak = useCallback(
    (text) => {
      if (muted || !("speechSynthesis" in window) || !text) return;
      window.speechSynthesis.cancel();
      const spoken = humanizeForSpeech(text);
      answerTextRef.current = spoken;
      const utter = new SpeechSynthesisUtterance(spoken);
      utter.rate = 1;
      utter.pitch = 1;
      utter.onstart = () => {
        setStatus("speaking");
        // Hands-free barge-in: passively listen for a spoken interruption.
        if (handsFree && supported) controlStart("monitoring");
      };
      utter.onend = () => {
        if (phaseRef.current === "monitoring") {
          phaseRef.current = "idle";
          try {
            recognitionRef.current?.abort();
          } catch {
            /* ignore */
          }
        }
        setStatus("idle");
      };
      window.speechSynthesis.speak(utter);
    },
    [muted, handsFree, supported, controlStart],
  );

  // Run an export and announce the result by voice + on screen.
  const runDownload = useCallback(
    (intent, range) => {
      setMeta(null);
      setError(null);
      let msg;
      if (intent === "dashboard") {
        exportDashboard(health);
        msg = "Downloading the bank dashboard data as a spreadsheet.";
      } else {
        const count = exportQueryLog(range);
        const span = range
          ? ` from ${fmtDate(range.start)} to ${fmtDate(range.end)}`
          : "";
        msg = count
          ? `Downloading the user queries${span} — ${count} ${count === 1 ? "entry" : "entries"} exported as a spreadsheet.`
          : `No user queries were found${span ? ` for ${fmtDate(range.start)} to ${fmtDate(range.end)}` : " yet"}, so the sheet is empty.`;
      }
      setAnswer(msg);
      speak(msg);
      // speak() drives status to speaking→idle; if muted it no-ops, so settle here.
      if (muted) setStatus("idle");
    },
    [health, speak, muted],
  );

  const ask = useCallback(
    async (q) => {
      const query = q.trim();
      if (!query) return;

      // Voice command: "download / export the queries / dashboard sheet",
      // optionally scoped to a date range ("…from 17 jun to 23 jun").
      const intent = detectDownloadIntent(query);
      if (intent) {
        runDownload(intent, intent === "queries" ? parseDateRange(query) : null);
        return;
      }

      setStatus("thinking");
      setError(null);
      setAnswer("");
      setMeta(null);

      const controller = new AbortController();
      abortRef.current = controller;
      const myReq = (reqIdRef.current += 1);
      const isStale = () => myReq !== reqIdRef.current;

      try {
        const data = await sendChat(query, 8, { signal: controller.signal });
        if (isStale()) return; // a newer query interrupted this one
        logQuery({
          query,
          source: "voice",
          route: data.route,
          confidence: data.confidence,
          grounded: data.grounded,
          latency_ms: data.latency_ms,
        });
        setAnswer(data.answer);
        setMeta({
          route: data.route,
          confidence: data.confidence,
          grounded: data.grounded,
          latency_ms: data.latency_ms,
        });
        speak(data.answer);
      } catch (e) {
        // Aborted requests are intentional interruptions — stay silent.
        if (e.name === "AbortError" || isStale()) return;
        setError(e.message);
        setStatus("idle");
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [speak, runDownload],
  );

  // Build the recognition instance once.
  useEffect(() => {
    if (!supported) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += chunk;
        else interim += chunk;
      }

      const phase = phaseRef.current;
      if (phase === "monitoring") {
        // We're only listening for the user to cut in over the spoken answer.
        const heard = `${interim} ${final}`.trim();
        if (heard && hasInterruptWord(heard, answerTextRef.current)) {
          cancelActive(); // stop the answer immediately
          setTranscript("");
          setAnswer("");
          setMeta(null);
          // Restart the recognizer to capture the user's new question.
          phaseRef.current = "switching";
          pendingListenRef.current = "listening";
          setStatus("listening");
          try {
            recognition.stop();
          } catch {
            /* ignore */
          }
        }
        return;
      }
      if (phase !== "listening") return; // ignore stray results while switching

      if (final) finalRef.current += final;
      setTranscript((finalRef.current + interim).trim());
    };

    recognition.onerror = (event) => {
      // Errors during passive monitoring / restart are expected — ignore them.
      if (phaseRef.current === "monitoring" || phaseRef.current === "switching") return;
      if (event.error === "no-speech") setError("Didn't catch that — try again.");
      else if (event.error !== "aborted") setError(`Mic error: ${event.error}`);
      phaseRef.current = "idle";
      setStatus("idle");
    };

    recognition.onend = () => {
      // A restart was requested (interruption or tap during another phase).
      const pending = pendingListenRef.current;
      if (pending) {
        pendingListenRef.current = false;
        phaseRef.current = pending;
        finalRef.current = "";
        recognition.continuous = pending === "monitoring";
        if (pending === "listening") {
          setStatus("listening");
          setTranscript("");
        }
        try {
          recognition.start();
        } catch {
          /* ignore */
        }
        return;
      }
      if (phaseRef.current === "monitoring") {
        // Keep monitoring as long as the assistant is still speaking.
        if (window.speechSynthesis?.speaking) {
          try {
            recognition.start();
          } catch {
            /* ignore */
          }
        } else {
          phaseRef.current = "idle";
        }
        return;
      }
      // Listening finished on silence -> submit the captured query.
      setStatus((s) => (s === "listening" ? "idle" : s));
      const text = finalRef.current.trim();
      phaseRef.current = "idle";
      if (text) ask(text);
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
    };
  }, [supported, ask, cancelActive]);

  function startListening() {
    if (!supported || phaseRef.current === "listening") return;
    // Interrupt anything in progress (speaking / thinking) before listening.
    cancelActive();
    setTranscript("");
    setAnswer("");
    setMeta(null);
    setError(null);
    setStatus("listening");
    controlStart("listening");
  }

  function stopListening() {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  }

  function toggleMic() {
    if (phaseRef.current === "listening") stopListening();
    else startListening();
  }

  // Stop everything when the panel closes.
  useEffect(() => {
    if (open) return;
    phaseRef.current = "idle";
    pendingListenRef.current = false;
    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }
    cancelActive();
    setStatus("idle");
    setTranscript("");
    setAnswer("");
    setMeta(null);
    setError(null);
  }, [open, cancelActive]);

  const listening = status === "listening";
  const busy = status === "thinking" || status === "speaking";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-ink-950/80 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        role="dialog"
        aria-label="Voice Assistant"
      >
        <div
          className={`relative flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-900/90 shadow-glow-lg backdrop-blur-2xl transition-transform duration-300 ${
            open ? "scale-100" : "scale-95"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-b from-brand-500/10 to-transparent px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-brand-400/40 blur-md" />
                <div className="relative rounded-xl border border-brand-400/40 bg-ink-900 p-2 text-brand-300 shadow-glow">
                  <Icon name="mic" className="h-5 w-5" />
                </div>
              </div>
              <div>
                <div className="font-display text-sm font-semibold text-white">
                  Voice Assistant
                </div>
                <div className="mt-0.5 text-[11px] text-ink-300">
                  Speak · grounded answers
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHandsFree((v) => !v)}
                className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                  handsFree
                    ? "border-brand-400/40 bg-brand-500/10 text-brand-200"
                    : "border-white/10 bg-white/5 text-ink-300 hover:text-white"
                }`}
                aria-pressed={handsFree}
                title={
                  handsFree
                    ? "Hands-free interrupt is on — just talk over the answer"
                    : "Hands-free interrupt is off — tap the mic to interrupt"
                }
              >
                Barge-in {handsFree ? "On" : "Off"}
              </button>
              <button
                onClick={() => {
                  setMuted((m) => {
                    if (!m) window.speechSynthesis?.cancel();
                    return !m;
                  });
                }}
                className={`rounded-lg border p-1.5 transition ${
                  muted
                    ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
                    : "border-white/10 bg-white/5 text-ink-200 hover:text-white"
                }`}
                aria-label={muted ? "Unmute spoken answers" : "Mute spoken answers"}
                title={muted ? "Spoken answers off" : "Spoken answers on"}
              >
                <Icon name="volume" className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-ink-200 transition hover:border-brand-400/40 hover:text-white"
                aria-label="Close voice assistant"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Body */}
          <div className="flex flex-col items-center gap-6 px-6 py-8">
            {!supported ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200">
                Voice input isn't supported in this browser. Try Chrome or Edge,
                or use the text assistant instead.
              </div>
            ) : (
              <>
                {/* Big mic button — always tappable so it can interrupt */}
                <button
                  onClick={toggleMic}
                  className={`group relative inline-flex h-28 w-28 items-center justify-center rounded-full text-ink-950 transition hover:scale-105 hover:shadow-glow-lg ${
                    listening
                      ? "bg-gradient-to-br from-rose-400 to-rose-500 shadow-glow-lg"
                      : "bg-gradient-to-br from-brand-400 to-brand-500 shadow-glow"
                  }`}
                  aria-label={
                    listening
                      ? "Stop listening"
                      : busy
                        ? "Interrupt and ask again"
                        : "Start listening"
                  }
                >
                  {(listening || busy) && (
                    <span
                      className={`absolute inset-0 animate-ping rounded-full ${
                        listening ? "bg-rose-400/40" : "bg-brand-400/40"
                      }`}
                    />
                  )}
                  <Icon
                    name={listening ? "micOff" : "mic"}
                    className="relative h-11 w-11"
                  />
                </button>

                {/* Status line */}
                <div className="text-center">
                  <div className="text-sm font-medium text-white">
                    {STATUS_LABEL[status]}
                  </div>
                  {status === "thinking" && (
                    <div className="mt-2 flex justify-center gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-300 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-300 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-300" />
                    </div>
                  )}
                  {busy ? (
                    <div className="mt-1 text-[11px] text-brand-300">
                      {handsFree && status === "speaking"
                        ? 'Just talk to interrupt — say "stop", "wait" or "hello"'
                        : "Tap the mic to interrupt and ask something else"}
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-ink-400">
                      Try: <span className="text-ink-200">"download the user queries from 17 Jun to 23 Jun"</span>{" "}
                      or <span className="text-ink-200">"export the dashboard data"</span>
                    </div>
                  )}
                </div>

                {/* Download quick actions (also triggerable by voice) */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => runDownload("queries")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-ink-100 transition hover:border-brand-400/50 hover:bg-brand-500/10 hover:text-white"
                  >
                    <Icon name="upload" className="h-3.5 w-3.5 rotate-180" />
                    Download user queries
                  </button>
                  <button
                    onClick={() => runDownload("dashboard")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-ink-100 transition hover:border-brand-400/50 hover:bg-brand-500/10 hover:text-white"
                  >
                    <Icon name="upload" className="h-3.5 w-3.5 rotate-180" />
                    Download dashboard data
                  </button>
                </div>
              </>
            )}

            {/* Transcript */}
            {transcript && (
              <div className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-ink-400">
                  You said
                </div>
                <div className="text-sm text-white">{transcript}</div>
              </div>
            )}

            {/* Answer */}
            {answer && (
              <div className="w-full rounded-2xl border border-brand-400/20 bg-brand-500/5 px-4 py-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-brand-300">
                    Assistant
                  </span>
                  {meta && (
                    <span className="text-[10px] text-ink-400">
                      {meta.route} · {Math.round((meta.confidence ?? 0) * 100)}%
                      {meta.grounded ? " · grounded" : ""}
                    </span>
                  )}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink-100">
                  {answer}
                </div>
                {status !== "speaking" && !muted && (
                  <button
                    onClick={() => speak(answer)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-ink-200 transition hover:text-white"
                  >
                    <Icon name="volume" className="h-3.5 w-3.5" />
                    Replay
                  </button>
                )}
              </div>
            )}

            {error && (
              <div className="w-full rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-center text-xs text-rose-200">
                {error}
              </div>
            )}
          </div>

          <footer className="border-t border-white/10 bg-ink-900/60 px-5 py-3 text-center text-[10px] text-ink-400">
            Answers are drawn only from the bank's internal knowledge base.
          </footer>
        </div>
      </div>
    </>
  );
}
