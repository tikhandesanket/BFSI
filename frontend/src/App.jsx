import { useCallback, useEffect, useState } from "react";
import ChatPanel from "./components/ChatPanel.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Icon from "./components/Icon.jsx";
import Sidebar from "./components/Sidebar.jsx";
import { fetchHealth } from "./api.js";

const NAV_IDS = ["overview", "topics", "upload", "gallery", "sources"];

export default function App() {
  const [health, setHealth] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [topic, setTopic] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("overview");

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
          active={active}
          onSelect={setActive}
          health={health}
        />

        <main className="relative flex-1 min-w-0 overflow-x-hidden">
          <Dashboard
            health={health}
            onOpenTopic={openTopic}
            onAskFree={openFree}
            onRefreshHealth={refreshHealth}
            onToggleMobileNav={() => setMobileOpen(true)}
          />
        </main>
      </div>

      <ChatPanel open={chatOpen} topic={topic} onClose={() => setChatOpen(false)} />

      {!chatOpen && (
        <button
          onClick={openFree}
          className="group fixed bottom-6 right-6 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-500 text-ink-950 shadow-glow-lg ring-1 ring-black/20 transition hover:scale-105 animate-pulseGlow"
          aria-label="Open banking assistant"
        >
          <Icon name="bot" className="h-6 w-6" />
          <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-lg border border-white/10 bg-ink-900/90 px-3 py-1.5 text-xs font-medium text-white shadow-glow group-hover:block">
            Ask the assistant
          </span>
        </button>
      )}
    </div>
  );
}
