"use client";

import { useWebSocket } from "@/hooks/useWebSocket";
import { useFallAlerts } from "@/hooks/useFallAlerts";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { Shield, Download, Wifi, WifiOff, Loader2, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-xs text-slate-400 tracking-widest tabular-nums">
      {time}
    </span>
  );
}

export default function Header() {
  const { connectionStatus } = useWebSocket();
  const { hasCriticalAlerts } = useFallAlerts();
  const { canInstall, triggerInstall } = useInstallPrompt();

  const statusConfig = {
    connected: {
      icon: <Wifi size={12} />,
      label: "Live",
      classes: "bg-safe/20 text-safe border border-safe/30",
      dot: "bg-safe",
    },
    connecting: {
      icon: <Loader2 size={12} className="animate-spin" />,
      label: "Connecting",
      classes: "bg-warning/20 text-warning border border-warning/30",
      dot: "bg-warning",
    },
    reconnecting: {
      icon: <Loader2 size={12} className="animate-spin" />,
      label: "Reconnecting",
      classes: "bg-warning/20 text-warning border border-warning/30",
      dot: "bg-warning",
    },
    offline: {
      icon: <WifiOff size={12} />,
      label: "Offline",
      classes: "bg-critical/20 text-critical border border-critical/30",
      dot: "bg-critical",
    },
  };

  const cfg = statusConfig[connectionStatus];

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 px-4 py-3"
      style={{ background: "linear-gradient(180deg, #0e1e34 0%, #0a1628 100%)", backdropFilter: "blur(16px)" }}
    >
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        {/* Branding */}
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #0ea5e922, #38bdf844)", border: "1px solid #38bdf822" }}
          >
            <Shield size={18} className="text-primary" />
            {hasCriticalAlerts && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-fall border-2 border-[#0a1628] status-pulse" />
            )}
          </div>
          <div>
            <h1 className="text-[13px] font-bold text-slate-100 leading-none tracking-tight">
              Mine Safety Command
            </h1>
            <p className="text-[10px] text-slate-500 mt-0.5 tracking-wide uppercase">
              Industrial IoT · Real-time
            </p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2.5">
          <LiveClock />

          {/* Connection badge */}
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.classes}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} live-dot`} />
            {cfg.icon}
            {cfg.label}
          </span>

          {/* Emergency indicator */}
          {hasCriticalAlerts && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-fall/20 border border-fall/40 text-fall text-[11px] font-bold status-pulse">
              <AlertTriangle size={11} />
              SOS
            </span>
          )}

          {/* Install button */}
          {canInstall && (
            <button
              onClick={triggerInstall}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg, #0ea5e9, #38bdf8)", color: "#080f1e" }}
              aria-label="Install app"
            >
              <Download size={11} />
              Install
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
