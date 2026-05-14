"use client";

import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useFallAlerts } from "@/hooks/useFallAlerts";

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function AlertBanner() {
  const { fallAlerts, acknowledgeAlert } = useFallAlerts();
  const activeAlerts = fallAlerts.filter((a) => !a.acknowledged);

  if (activeAlerts.length === 0) return null;

  return (
    <div className="slide-down glow-fall rounded-2xl overflow-hidden border border-fall/40 mb-4">
      {/* Header strip */}
      <div className="critical-flash flex items-center gap-2.5 px-4 py-3 border-b border-fall/30">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fall/30 border border-fall/50">
          <AlertTriangle size={13} className="text-fall" />
        </span>
        <span className="text-sm font-bold text-fall tracking-wide uppercase">
          ⚠ Emergency — Fall Detected
        </span>
        <span className="ml-auto bg-fall/30 border border-fall/50 text-fall text-xs font-bold px-2 py-0.5 rounded-full">
          {activeAlerts.length} Active
        </span>
      </div>

      {/* Alert rows */}
      <div className="divide-y divide-fall/10">
        {activeAlerts.map((alert) => (
          <div
            key={alert.worker_id}
            className="flex items-center gap-3 px-4 py-3"
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-100 text-sm truncate">
                {alert.name}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Fell {timeAgo(alert.triggered_at)}
                {alert.gas_level > 0 && (
                  <span className="ml-2 text-warning">· {alert.gas_level} ppm</span>
                )}
              </p>
            </div>
            <button
              onClick={() => acknowledgeAlert(alert.worker_id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-safe/15 border border-safe/30 text-safe text-xs font-semibold hover:bg-safe/25 active:scale-95 transition-all shrink-0"
              aria-label={`Acknowledge fall for ${alert.name}`}
            >
              <CheckCircle2 size={12} />
              Acknowledge
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
