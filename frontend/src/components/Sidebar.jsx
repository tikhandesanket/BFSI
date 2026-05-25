import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";

const NAV = [
  { id: "overview", label: "Dashboard", icon: "dashboard", href: "#overview" },
  { id: "topics", label: "Manage topics", icon: "grid", href: "#topics" },
  { id: "upload", label: "Upload docs", icon: "upload", href: "#upload" },
  { id: "gallery", label: "Knowledge feed", icon: "book", href: "#gallery" },
  { id: "sources", label: "Reporting", icon: "shield", href: "#sources" },
];

function scrollToHash(hash) {
  const id = hash.replace("#", "");
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onCloseMobile,
  onOpenChat,
  active = "overview",
  onSelect,
  health,
}) {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 1024 && mobileOpen) onCloseMobile?.();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mobileOpen, onCloseMobile]);

  function handleNav(item, e) {
    e?.preventDefault();
    onSelect?.(item.id);
    scrollToHash(item.href);
    onCloseMobile?.();
  }

  function handleChat() {
    onOpenChat?.();
    onCloseMobile?.();
  }

  const width = collapsed ? "lg:w-[78px]" : "lg:w-[252px]";

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onCloseMobile}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-white/[0.05] bg-ink-950 transition-all duration-300 lg:relative lg:translate-x-0 ${width} ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative shrink-0">
              <div className="relative rounded-xl border border-brand-400/40 bg-ink-900 p-2 text-brand-400 shadow-glow">
                <Icon name="lock" className="h-5 w-5" />
              </div>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate font-display text-base font-bold tracking-wide text-white">
                  Bank<span className="text-brand-400">.In</span>
                </div>
                <div className="truncate text-[10px] uppercase tracking-[0.18em] text-ink-300">
                  Banking Assistant
                </div>
              </div>
            )}
          </div>
          <button
            onClick={onCloseMobile}
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-ink-200 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1.5">
            {NAV.map((item) => {
              const isActive = active === item.id;
              return (
                <li key={item.id}>
                  <a
                    href={item.href}
                    onClick={(e) => handleNav(item, e)}
                    title={collapsed ? item.label : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                      isActive
                        ? "bg-gradient-to-r from-brand-400 to-brand-500 text-ink-950 shadow-glow"
                        : "text-ink-200 hover:bg-white/5 hover:text-white"
                    } ${collapsed ? "justify-center px-0" : ""}`}
                  >
                    <Icon
                      name={item.icon}
                      className={`h-[18px] w-[18px] shrink-0 ${
                        isActive ? "text-ink-950" : "text-ink-300 group-hover:text-brand-300"
                      }`}
                    />
                    {!collapsed && (
                      <span className={`truncate font-medium ${isActive ? "text-ink-950" : ""}`}>
                        {item.label}
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>

          {!collapsed && (
            <>
              <div className="mt-6 mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-ink-400">
                Quick
              </div>
              <button
                onClick={handleChat}
                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-200 transition hover:bg-white/5 hover:text-white"
              >
                <Icon name="bot" className="h-[18px] w-[18px] shrink-0 text-ink-300 group-hover:text-brand-300" />
                <span className="flex-1 text-left font-medium">Ask the Assistant</span>
                <Icon name="arrow" className="h-3.5 w-3.5 text-brand-400 transition group-hover:translate-x-0.5" />
              </button>
            </>
          )}

          {collapsed && (
            <button
              onClick={handleChat}
              title="Ask the Assistant"
              className="mt-3 flex w-full items-center justify-center rounded-xl py-2 text-ink-300 transition hover:bg-white/5 hover:text-brand-300"
            >
              <Icon name="bot" className="h-[18px] w-[18px]" />
            </button>
          )}
        </nav>

        {/* Profile + theme toggle */}
        <div className="border-t border-white/[0.05] p-3">
          {/* Profile card */}
          <div
            className={`flex items-center gap-3 rounded-2xl bg-ink-800/70 p-2 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <div className="relative shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-300 to-brand-500 text-sm font-bold text-ink-950">
                BA
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-900 bg-emerald-400" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">Banker</div>
                <div className="text-[10px] uppercase tracking-wider text-emerald-400">
                  {health ? "Active" : "Offline"}
                </div>
              </div>
            )}
          </div>

          {/* Light / Dark toggle (cosmetic) */}
          {!collapsed && (
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-ink-800/70 p-1">
              <button
                onClick={() => setTheme("light")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-medium transition ${
                  theme === "light"
                    ? "bg-gradient-to-r from-brand-400 to-brand-500 text-ink-950 shadow-glow"
                    : "text-ink-300 hover:text-white"
                }`}
              >
                <Icon name="sparkle" className="h-3.5 w-3.5" />
                Light
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-medium transition ${
                  theme === "dark"
                    ? "bg-ink-950 text-white shadow-soft"
                    : "text-ink-300 hover:text-white"
                }`}
              >
                <Icon name="lock" className="h-3.5 w-3.5" />
                Dark
              </button>
            </div>
          )}

          {/* Collapse toggle (desktop) */}
          <button
            onClick={onToggle}
            className={`mt-3 hidden w-full items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[11px] text-ink-300 transition hover:border-brand-400/40 hover:text-white lg:flex ${
              collapsed ? "justify-center" : "justify-start"
            }`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon
              name={collapsed ? "chevronRight" : "chevronLeft"}
              className="h-3.5 w-3.5 shrink-0"
            />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
