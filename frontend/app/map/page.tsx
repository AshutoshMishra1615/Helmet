"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Worker } from "@/components/WorkerCard";
import { MapPin, Users, WifiOff, AlertTriangle, RefreshCw } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Dynamically import map (SSR disabled — Leaflet requires browser)
const WorkerMap = dynamic(() => import("@/components/WorkerMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-surface-2/50 rounded-2xl">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Loading map…</span>
      </div>
    </div>
  ),
});

const STATUS_COLORS: Record<string, string> = {
  SAFE: "text-safe bg-safe/10 border-safe/25",
  WARNING: "text-warning bg-warning/10 border-warning/25",
  CRITICAL: "text-critical bg-critical/10 border-critical/25",
  FALL: "text-fall bg-fall/10 border-fall/30",
  INACTIVE: "text-slate-400 bg-slate-400/10 border-slate-400/20",
};

export default function MapPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const { lastUpdate } = useWebSocket();

  const fetchWorkers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/workers`);
      if (res.ok) {
        const data: Worker[] = await res.json();
        setWorkers(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  // Merge real-time updates
  useEffect(() => {
    if (!lastUpdate) return;
    setWorkers((prev) =>
      prev.map((w) =>
        w.worker_id === lastUpdate.worker_id
          ? {
              ...w,
              status: lastUpdate.status,
              last_seen: lastUpdate.timestamp,
              fall_acknowledged: lastUpdate.fall_acknowledged,
              // Update GPS if available and valid
              ...(lastUpdate.gps_valid && lastUpdate.latitude != null
                ? { last_lat: lastUpdate.latitude, last_lng: lastUpdate.longitude }
                : {}),
            }
          : w
      )
    );
  }, [lastUpdate]);

  const gpsWorkers = useMemo(
    () => workers.filter((w) => w.last_lat != null && w.last_lng != null),
    [workers]
  );
  const noGpsWorkers = useMemo(
    () => workers.filter((w) => w.last_lat == null || w.last_lng == null),
    [workers]
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in" style={{ height: "calc(100vh - 130px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-primary" />
          <h1 className="text-base font-bold text-slate-100">Live Map</h1>
        </div>
        <span className="text-xs text-slate-500">{gpsWorkers.length} / {workers.length} workers tracked</span>
        <button
          onClick={fetchWorkers}
          className="ml-auto p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-surface-2 transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-border/30"
        style={{ background: "linear-gradient(180deg, #0a1628 0%, #080f1e 100%)" }}
      >
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : gpsWorkers.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500">
            <MapPin size={40} className="opacity-20" />
            <p className="font-medium text-slate-400">No GPS data yet</p>
            <p className="text-xs text-center px-8">
              Workers will appear here once their helmet sends a valid GPS fix
            </p>
          </div>
        ) : (
          <WorkerMap workers={workers} focusWorkerId={selected ?? undefined} className="h-full" />
        )}
      </div>

      {/* Worker sidebar list */}
      <div className="flex-shrink-0 space-y-2 max-h-48 overflow-y-auto">
        {gpsWorkers.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin size={10} className="text-primary" />
              GPS Active ({gpsWorkers.length})
            </p>
            {gpsWorkers.map((w) => (
              <button
                key={w.worker_id}
                onClick={() => setSelected(selected === w.worker_id ? null : w.worker_id)}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${
                  selected === w.worker_id
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/25 bg-surface-2/40 hover:bg-surface-2/70"
                }`}
              >
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[w.status]}`}>
                  {w.status}
                </span>
                <span className="text-sm font-medium text-slate-200 truncate">{w.name}</span>
                <span className="text-[10px] font-mono text-slate-500 ml-auto">
                  {w.last_lat?.toFixed(4)}, {w.last_lng?.toFixed(4)}
                </span>
              </button>
            ))}
          </div>
        )}

        {noGpsWorkers.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <WifiOff size={10} />
              No GPS ({noGpsWorkers.length})
            </p>
            {noGpsWorkers.map((w) => (
              <div
                key={w.worker_id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border/15 opacity-50"
              >
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[w.status]}`}>
                  {w.status}
                </span>
                <span className="text-sm text-slate-400 truncate">{w.name}</span>
                <span className="text-[10px] text-slate-600 ml-auto">No fix</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
