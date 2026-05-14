"use client";

import { useState, useEffect, useCallback } from "react";
import WorkerCard, { type Worker } from "@/components/WorkerCard";
import { useWebSocket } from "@/hooks/useWebSocket";
import { BellOff, BellRing, Clock, AlertTriangle, Flame, Shield } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface AlertEvent {
  id: number;
  worker_id: string;
  event_type: "FALL" | "CRITICAL" | "WARNING";
  triggered_at: string;
  acknowledged_at: string | null;
  gas_level: number;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function EventTypeBadge({ type }: { type: AlertEvent["event_type"] }) {
  const cfg = {
    FALL: { icon: <AlertTriangle size={11} />, label: "Fall", cls: "bg-fall/15 text-fall border-fall/30" },
    CRITICAL: { icon: <Flame size={11} />, label: "Critical Gas", cls: "bg-critical/15 text-critical border-critical/30" },
    WARNING: { icon: <AlertTriangle size={11} />, label: "Warning", cls: "bg-warning/15 text-warning border-warning/30" },
  }[type];
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Worker[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { lastUpdate } = useWebSocket();

  const fetchAlerts = useCallback(async () => {
    try {
      const [aRes, eRes] = await Promise.all([
        fetch(`${API_URL}/alerts`),
        fetch(`${API_URL}/alert-events?limit=25`),
      ]);
      if (aRes.ok) setAlerts(await aRes.json());
      if (eRes.ok) setEvents(await eRes.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Merge real-time updates
  useEffect(() => {
    if (!lastUpdate) return;
    if (lastUpdate.status === "SAFE") {
      setAlerts((prev) => prev.filter((w) => w.worker_id !== lastUpdate.worker_id));
    } else {
      setAlerts((prev) => {
        const exists = prev.find((w) => w.worker_id === lastUpdate.worker_id);
        if (exists) {
          return prev.map((w) =>
            w.worker_id === lastUpdate.worker_id
              ? { ...w, status: lastUpdate.status, last_seen: lastUpdate.timestamp, fall_acknowledged: lastUpdate.fall_acknowledged }
              : w
          );
        }
        return [
          { worker_id: lastUpdate.worker_id, name: lastUpdate.name ?? lastUpdate.worker_id, status: lastUpdate.status, last_seen: lastUpdate.timestamp, fall_acknowledged: false },
          ...prev,
        ];
      });
    }
    // Refresh event history on significant events
    if (["FALL", "CRITICAL", "WARNING"].includes(lastUpdate.status)) {
      fetch(`${API_URL}/alert-events?limit=25`)
        .then((r) => r.json()).then(setEvents).catch(() => {});
    }
  }, [lastUpdate]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-critical/20 border border-critical/30">
          <BellRing size={15} className="text-critical" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-200 leading-none">Active Alerts</h2>
          <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">Real-time hazard monitor</p>
        </div>
        {!loading && alerts.length > 0 && (
          <span className="ml-auto bg-critical/20 text-critical text-xs font-bold px-2.5 py-1 rounded-full border border-critical/30 status-pulse">
            {alerts.length} Active
          </span>
        )}
      </div>

      {/* Active alert cards */}
      {loading ? (
        <div className="text-center py-16 text-slate-500">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm">Loading…</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-2xl border border-border/30 px-4 py-10 text-center"
          style={{ background: "linear-gradient(135deg, #14532d11, #0f1f35)" }}
        >
          <Shield size={36} className="mx-auto mb-3 text-safe opacity-60" />
          <p className="font-semibold text-safe text-sm">All workers are safe</p>
          <p className="text-xs text-slate-500 mt-1">No active hazards detected.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {alerts.map((worker) => (
            <WorkerCard
              key={worker.worker_id}
              worker={worker}
              latestGas={lastUpdate?.worker_id === worker.worker_id ? lastUpdate.gas_level : undefined}
              latestTemp={lastUpdate?.worker_id === worker.worker_id ? lastUpdate.temperature : undefined}
            />
          ))}
        </div>
      )}

      {/* Alert History Timeline */}
      {events.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={13} className="text-slate-500" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Incident History</span>
            <span className="text-[10px] text-slate-600 ml-auto">Last 25 events</span>
          </div>

          <div className="rounded-2xl border border-border/30 overflow-hidden divide-y divide-border/20"
            style={{ background: "linear-gradient(180deg, #0f1f35 0%, #0a1628 100%)" }}
          >
            {events.map((evt) => (
              <div key={evt.id} className="flex items-center gap-3 px-3.5 py-3">
                {/* Left column: type + worker */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <EventTypeBadge type={evt.event_type} />
                    <span className="text-xs font-semibold text-slate-300 font-mono">{evt.worker_id}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span>{timeAgo(evt.triggered_at)}</span>
                    {evt.gas_level > 0 && (
                      <span className="text-warning">{evt.gas_level} ppm</span>
                    )}
                  </div>
                </div>

                {/* Right: acknowledged state */}
                {evt.acknowledged_at ? (
                  <span className="flex items-center gap-1 text-[10px] text-safe font-medium shrink-0">
                    <Shield size={10} />
                    Ack'd
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-critical shrink-0 status-pulse" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && events.length === 0 && alerts.length === 0 && (
        <div className="text-center text-slate-600 text-xs py-4">
          <BellOff size={24} className="mx-auto mb-2 opacity-30" />
          No incident history yet.
        </div>
      )}
    </div>
  );
}
