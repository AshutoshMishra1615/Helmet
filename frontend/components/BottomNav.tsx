"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BellRing, User, Map, Settings } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map", label: "Map", icon: Map },
  { href: "/alerts", label: "Alerts", icon: BellRing },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/profile", label: "Account", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { lastUpdate } = useWebSocket();
  const [alertCount, setAlertCount] = useState(0);

  // Fetch initial alert count
  useEffect(() => {
    fetch(`${API_URL}/alerts`)
      .then((r) => r.json())
      .then((data: unknown[]) => setAlertCount(data.length))
      .catch(() => {});
  }, []);

  // Update count on WS events
  useEffect(() => {
    if (!lastUpdate) return;
    if (["FALL", "CRITICAL", "WARNING", "INACTIVE"].includes(lastUpdate.status)) {
      setAlertCount((prev) => Math.max(prev, 1));
    }
    if (lastUpdate.status === "SAFE") {
      fetch(`${API_URL}/alerts`)
        .then((r) => r.json())
        .then((data: unknown[]) => setAlertCount(data.length))
        .catch(() => {});
    }
  }, [lastUpdate]);

  // Don't render nav on auth pages
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border/50 safe-area-bottom"
      style={{ background: "linear-gradient(180deg, #0d1d33 0%, #080f1e 100%)", backdropFilter: "blur(20px)" }}
    >
      <div className="max-w-2xl mx-auto flex">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href === "/map" && pathname.startsWith("/map"));
          const isAlerts = href === "/alerts";
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-all duration-200 active:scale-95 ${
                active ? "text-primary" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <span className="relative">
                <Icon
                  size={22}
                  strokeWidth={active ? 2.2 : 1.8}
                  className={`transition-all duration-200 ${active ? "drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]" : ""}`}
                />
                {/* Active indicator dot */}
                {active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                    style={{ background: "linear-gradient(135deg, #0ea5e9, #38bdf8)" }}
                  />
                )}
                {/* Alert badge */}
                {isAlerts && alertCount > 0 && !active && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-critical border border-background text-[9px] font-bold text-white flex items-center justify-center status-pulse">
                    {alertCount > 9 ? "9+" : alertCount}
                  </span>
                )}
              </span>
              <span className={`text-[10px] tracking-wide ${active ? "text-primary font-semibold" : ""}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
