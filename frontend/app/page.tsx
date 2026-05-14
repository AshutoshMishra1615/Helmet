"use client";

import { useState, useEffect, useCallback } from "react";
import WorkerCard, { type Worker } from "@/components/WorkerCard";
import AlertBanner from "@/components/AlertBanner";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  RefreshCw, Users, CheckCircle2, AlertTriangle, Activity,
  Flame, WifiOff, Zap
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const STATUS_ORDER: Record<string, number> = {
  FALL: 0, CRITICAL: 1, WARNING: 2, INACTIVE: 3, SAFE: 4,
};

function SkeletonCard() {
  return (
    <div className="flex rounded-2xl overflow-hidden border border-border/30 shadow-card">
      <div className="w-1 shrink-0 shimmer" />
      <div className="flex-1 px-3.5 py-3 space-y-2.5" style={{ background: "linear-gradient(180deg, #0f1f35 0%, #0a1628 100%)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl shimmer shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 shimmer rounded w-28" />
            <div className="h-2.5 shimmer rounded w-16" />
          </div>
          <div className="h-6 shimmer rounded-full w-20" />
        </div>
        <div className="h-1 shimmer rounded-full" />
        <div className="h-2.5 shimmer rounded w-24 ml-auto" />
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
}

function StatCard({ label, value, icon, color, bg, border }: StatCardProps) {
  return (
    <div className={`rounded-2xl p-3 border ${border} flex flex-col gap-1.5 glass card-lift`} style={{ background: bg }}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${color} opacity-80`}>{label}</span>
        <span className={color}>{icon}</span>
      </div>
      <p className={`text-2xl font-bold stat-number count-anim ${color}`}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lastUpdate, allUpdates } = useWebSocket();

  const fetchWorkers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/workers`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Worker[] = await res.json();
      setWorkers(data);
      setError(null);
    } catch {
      setError("Failed to load workers. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  // Merge real-time WS updates
  useEffect(() => {
    if (!lastUpdate) return;
    setWorkers((prev) => {
      const exists = prev.find((w) => w.worker_id === lastUpdate.worker_id);
      if (exists) {
        return prev.map((w) =>
          w.worker_id === lastUpdate.worker_id
            ? {
                ...w,
                status: lastUpdate.status,
                last_seen: lastUpdate.timestamp,
                fall_acknowledged: lastUpdate.fall_acknowledged,
                anomaly_predicted: lastUpdate.anomaly_predicted,
                activity: lastUpdate.activity,
                ...(lastUpdate.gps_valid && lastUpdate.latitude != null
                  ? { last_lat: lastUpdate.latitude, last_lng: lastUpdate.longitude }
                  : {}),
              }
            : w
        );
      }
      fetchWorkers();
      return prev;
    });
  }, [lastUpdate, fetchWorkers]);

  const safeCount = workers.filter((w) => w.status === "SAFE").length;
  const alertCount = workers.filter((w) => w.status !== "SAFE" && w.status !== "INACTIVE").length;
  const fallCount = workers.filter((w) => w.status === "FALL").length;

  // Sort workers by severity
  const sortedWorkers = [...workers].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Emergency banner */}
      <AlertBanner />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard
          label="Total"
          value={loading ? "—" : workers.length}
          icon={<Users size={14} />}
          color="text-primary"
          bg="linear-gradient(135deg, #0c4a6e22, #38bdf811)"
          border="border-primary/20"
        />
        <StatCard
          label="Safe"
          value={loading ? "—" : safeCount}
          icon={<CheckCircle2 size={14} />}
          color="text-safe"
          bg="linear-gradient(135deg, #14532d22, #22c55e11)"
          border="border-safe/20"
        />
        <StatCard
          label="Alerts"
          value={loading ? "—" : alertCount}
          icon={<AlertTriangle size={14} />}
          color={alertCount > 0 ? "text-critical" : "text-slate-500"}
          bg={alertCount > 0 ? "linear-gradient(135deg, #7f1d1d22, #ef444411)" : "transparent"}
          border={alertCount > 0 ? "border-critical/25" : "border-border/30"}
        />
      </div>

      {/* Section header */}
      <div className="flex items-center gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary live-dot" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Live Workers
          </span>
        </div>
        {fallCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-fall px-2 py-0.5 rounded-full bg-fall/15 border border-fall/30 status-pulse">
            <AlertTriangle size={9} />
            {fallCount} FALL
          </span>
        )}
        <button
          onClick={fetchWorkers}
          className="ml-auto p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-surface-2 transition-colors active:scale-90"
          aria-label="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-2xl border border-critical/30 text-sm text-critical text-center bg-critical/10">
          {error}
        </div>
      )}

      {/* Workers list */}
      <div className="space-y-2.5">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          : workers.length === 0
          ? (
            <div className="text-center py-16 text-slate-500">
              <Users size={40} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium text-slate-400">No workers registered</p>
              <p className="text-xs mt-1">POST sensor data to see workers appear here.</p>
            </div>
          )
          : sortedWorkers.map((worker, i) => (
            <div key={worker.worker_id} className="card-enter" style={{ animationDelay: `${i * 60}ms` }}>
              <WorkerCard
                worker={worker}
                latestGas={
                  lastUpdate?.worker_id === worker.worker_id ? lastUpdate.gas_level : undefined
                }
                latestTemp={
                  lastUpdate?.worker_id === worker.worker_id ? lastUpdate.temperature : undefined
                }
              />
            </div>
          ))}
      </div>

      {/* Live Event Feed */}
      {allUpdates.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-2.5">
            <Zap size={13} className="text-primary" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Feed</span>
          </div>
          <div className="rounded-2xl border border-border/30 overflow-hidden divide-y divide-border/20"
            style={{ background: "linear-gradient(180deg, #0f1f35 0%, #0a1628 100%)" }}
          >
            {allUpdates.slice(0, 5).map((upd, i) => {
              const statusColors: Record<string, string> = {
                SAFE: "text-safe", WARNING: "text-warning", CRITICAL: "text-critical",
                FALL: "text-fall", INACTIVE: "text-inactive"
              };
              return (
                <div key={i} className="flex items-center gap-3 px-3.5 py-2.5">
                  <Activity size={12} className={statusColors[upd.status] ?? "text-slate-500"} />
                  <span className="text-xs font-medium text-slate-300 truncate flex-1">
                    {upd.name ?? upd.worker_id}
                  </span>
                  <span className={`text-[11px] font-bold ${statusColors[upd.status]}`}>
                    {upd.status}
                  </span>
                  <span className="text-[10px] text-slate-600 font-mono ml-1">
                    {new Date(upd.timestamp).toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
