import { useCallback, useEffect, useState } from "react";
import ChatPanel from "./components/ChatPanel.jsx";
import Dashboard from "./components/Dashboard.jsx";
import ExplorePage from "./components/ExplorePage.jsx";
import Icon from "./components/Icon.jsx";
import MetricsPage from "./components/MetricsPage.jsx";
import Sidebar from "./components/Sidebar.jsx";
import TopicsPage from "./components/TopicsPage.jsx";
import UploadPage from "./components/UploadPage.jsx";
import VoiceAssistant from "./components/VoiceAssistant.jsx";
import { fetchHealth } from "./api.js";

const NAV_IDS = ["overview", "topics", "upload", "gallery", "sources"];

export default function App() {
  const [health, setHealth] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [topic, setTopic] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("overview");
  const [page, setPage] = useState("dashboard");

  const refreshHealth = useCallback(() => {
    fetchHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        setChatOpen(false);
        setMobileOpen(false);
        setVoiceOpen(false);
      }
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        setChatOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    NAV_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  function openTopic(t) {
    setTopic(t);
    setChatOpen(true);
  }

  function openFree() {
    setTopic(null);
    setChatOpen(true);
  }

  return (
    <div className="min-h-full p-4 md:p-6 lg:p-8">
      <div className="app-card relative mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1500px] overflow-hidden md:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-4rem)]">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          onOpenChat={openFree}
          onOpenVoice={() => setVoiceOpen(true)}
          active={active}
          onSelect={setActive}
          onNavigatePage={setPage}
          health={health}
        />

        <main className="relative flex-1 min-w-0 overflow-x-hidden">
          {page === "dashboard" && (
            <Dashboard
              health={health}
              onOpenTopic={openTopic}
              onAskFree={openFree}
              onGoToExplore={() => setPage("explore")}
              onToggleMobileNav={() => setMobileOpen(true)}
            />
          )}
          {page === "topics" && (
            <TopicsPage
              onBack={() => setPage("dashboard")}
              onOpenTopic={openTopic}
              onToggleMobileNav={() => setMobileOpen(true)}
            />
          )}
          {page === "upload" && (
            <UploadPage
              onBack={() => setPage("dashboard")}
              onOpenTopic={openTopic}
              onRefreshHealth={refreshHealth}
              onToggleMobileNav={() => setMobileOpen(true)}
            />
          )}
          {page === "explore" && (
            <ExplorePage
              onBack={() => setPage("dashboard")}
              onOpenTopic={openTopic}
              onRefreshHealth={refreshHealth}
              onToggleMobileNav={() => setMobileOpen(true)}
            />
          )}
          {page === "metrics" && (
            <MetricsPage
              onBack={() => setPage("dashboard")}
              onToggleMobileNav={() => setMobileOpen(true)}
            />
          )}
        </main>
      </div>

      <ChatPanel open={chatOpen} topic={topic} onClose={() => setChatOpen(false)} />
      <VoiceAssistant open={voiceOpen} onClose={() => setVoiceOpen(false)} health={health} />

      {!chatOpen && !voiceOpen && (
        <div className="fixed bottom-6 right-6 z-30 flex flex-col items-center gap-3">
          <button
            onClick={() => setVoiceOpen(true)}
            className="group relative inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-ink-900/90 text-brand-300 shadow-glow ring-1 ring-black/20 backdrop-blur transition hover:scale-105 hover:text-white"
            aria-label="Open voice assistant"
          >
            <Icon name="mic" className="h-6 w-6" />
            <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-lg border border-white/10 bg-ink-900/90 px-3 py-1.5 text-xs font-medium text-white shadow-glow group-hover:block">
              Voice assistant
            </span>
          </button>

          <button
            onClick={openFree}
            className="group relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-500 text-ink-950 shadow-glow-lg ring-1 ring-black/20 transition hover:scale-105 animate-pulseGlow"
            aria-label="Open banking assistant"
          >
            <Icon name="bot" className="h-6 w-6" />
            <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-lg border border-white/10 bg-ink-900/90 px-3 py-1.5 text-xs font-medium text-white shadow-glow group-hover:block">
              Ask the assistant
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
