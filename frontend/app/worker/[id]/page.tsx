"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft, User, CheckCircle2, AlertTriangle, Flame,
  WifiOff, Thermometer, Wind, Clock, Activity, CheckCheck, MapPin, BrainCircuit, ShieldOff
} from "lucide-react";
import { useFallAlerts } from "@/hooks/useFallAlerts";

const WorkerMap = dynamic(() => import("@/components/WorkerMap"), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface WorkerDetail {
  worker_id: string;
  name: string;
  status: "SAFE" | "WARNING" | "CRITICAL" | "FALL" | "INACTIVE" | "GEO_VIOLATION";
  last_seen: string;
  fall_acknowledged: boolean;
  anomaly_predicted?: boolean;
  activity?: string;
  last_lat?: number | null;
  last_lng?: number | null;
}

interface SensorReading {
  id: number;
  worker_id: string;
  timestamp: string;
  gas_level: number;
  fall_detected: boolean;
  temperature: number;
}

const STATUS_CFG = {
  SAFE: { label: "Safe", cls: "text-safe bg-safe/15 border-safe/30", icon: <CheckCircle2 size={14} /> },
  WARNING: { label: "Warning", cls: "text-warning bg-warning/15 border-warning/30", icon: <AlertTriangle size={14} /> },
  CRITICAL: { label: "Critical", cls: "text-critical bg-critical/15 border-critical/30", icon: <Flame size={14} /> },
  FALL: { label: "Fall Detected", cls: "text-fall bg-fall/15 border-fall/30 status-pulse", icon: <AlertTriangle size={14} /> },
  INACTIVE: { label: "Inactive", cls: "text-inactive bg-inactive/15 border-inactive/30", icon: <WifiOff size={14} /> },
  GEO_VIOLATION: { label: "Out of Bounds", cls: "text-[#d946ef] bg-[#d946ef]/15 border-[#d946ef]/30", icon: <ShieldOff size={14} /> },
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function GasIndicator({ level }: { level: number }) {
  const pct = Math.min(100, (level / 500) * 100);
  const color = level > 300 ? "#ef4444" : level > 200 ? "#f59e0b" : "#22c55e";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 gas-bar-track">
        <div className="gas-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono text-xs font-semibold" style={{ color }}>
        {level} <span className="text-slate-500 font-normal">ppm</span>
      </span>
    </div>
  );
}

export default function WorkerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workerId = typeof params.id === "string" ? params.id : (params.id?.[0] ?? "");
  const { acknowledgeAlert } = useFallAlerts();

  const [worker, setWorker] = useState<WorkerDetail | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [wRes, hRes] = await Promise.all([
        fetch(`${API_URL}/workers`),
        fetch(`${API_URL}/worker/${workerId}/history?limit=20`),
      ]);
      if (!wRes.ok) throw new Error();
      const workers: WorkerDetail[] = await wRes.json();
      const found = workers.find((w) => w.worker_id === workerId);
      if (!found) { setNotFound(true); return; }
      setWorker(found);
      if (hRes.ok) setHistory(await hRes.json());
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !worker) {
    return (
      <div className="text-center py-20 text-slate-500">
        <p className="font-semibold">Worker not found</p>
        <button onClick={() => router.back()} className="mt-4 text-primary text-sm">← Go back</button>
      </div>
    );
  }

  const cfg = STATUS_CFG[worker.status];
  const latestReading = history[0];
  const avgGas = history.length > 0
    ? Math.round(history.slice(0, 5).reduce((s, r) => s + r.gas_level, 0) / Math.min(5, history.length))
    : 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-slate-400 hover:text-primary text-sm transition-colors active:scale-95"
      >
        <ArrowLeft size={15} />
        Workers
      </button>

      {/* Worker identity card */}
      <div className="rounded-2xl border border-border/40 overflow-hidden shadow-card"
        style={{ background: "linear-gradient(180deg, #0f1f35 0%, #0a1628 100%)" }}
      >
        {/* Status strip */}
        <div className={`h-1.5 w-full ${
          worker.status === "FALL" ? "bg-fall" :
          worker.status === "CRITICAL" ? "bg-critical" :
          worker.status === "GEO_VIOLATION" ? "bg-[#d946ef]" :
          worker.status === "WARNING" ? "bg-warning" :
          worker.status === "SAFE" ? "bg-safe" : "bg-inactive"
        }`} />

        <div className="px-4 py-4">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0
              ${worker.status === "FALL" ? "bg-fall/15 border-fall/40" :
                worker.status === "CRITICAL" ? "bg-critical/15 border-critical/40" :
                worker.status === "GEO_VIOLATION" ? "bg-[#d946ef]/15 border-[#d946ef]/40" :
                "border-border/50 bg-surface-3/50"}`}
            >
              <User size={22} className={
                worker.status === "FALL" ? "text-fall" :
                worker.status === "CRITICAL" ? "text-critical" :
                worker.status === "GEO_VIOLATION" ? "text-[#d946ef]" : "text-slate-400"
              } />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-100 leading-tight">{worker.name}</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{worker.worker_id}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.cls}`}>
                  {cfg.icon} {cfg.label}
                </span>
                <span className="text-[11px] text-slate-500">{timeAgo(worker.last_seen)}</span>
              </div>
            </div>
          </div>

          {/* Fall acknowledge banner */}
          {worker.status === "FALL" && !worker.fall_acknowledged && (
            <div className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2 critical-flash border border-fall/30">
              <AlertTriangle size={14} className="text-fall shrink-0" />
              <span className="text-sm text-fall font-semibold flex-1">Unacknowledged fall alert!</span>
              <button
                onClick={() => { acknowledgeAlert(worker.worker_id); fetchData(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-safe/15 border border-safe/30 text-safe text-xs font-bold hover:bg-safe/25 active:scale-95 transition-all"
              >
                <CheckCheck size={12} />
                Acknowledge
              </button>
            </div>
          )}

          {/* ML Anomaly Banner */}
          {worker.anomaly_predicted && worker.status !== "CRITICAL" && worker.status !== "FALL" && (
            <div className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2 bg-[#8b5cf6]/15 border border-[#8b5cf6]/30">
              <BrainCircuit size={14} className="text-[#a78bfa] shrink-0" />
              <span className="text-sm text-[#a78bfa] font-semibold flex-1">ML Predictor Warning: Rapid gas level rise pattern detected.</span>
            </div>
          )}

          {/* Activity Indicator */}
          {worker.activity && worker.activity !== "Unknown" && (
            <div className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2 bg-surface-2/50 border border-border/30">
              <Activity size={14} className={
                worker.activity === "Idling" ? "text-slate-400" :
                worker.activity === "Walking" ? "text-teal-400" :
                worker.activity === "Running" ? "text-amber-400" :
                worker.activity === "Fall" ? "text-red-400" : "text-slate-400"
              } />
              <span className="text-sm text-slate-300 font-medium">Activity:</span>
              <span className={`text-sm font-bold uppercase tracking-wide ${
                worker.activity === "Idling" ? "text-slate-400" :
                worker.activity === "Walking" ? "text-teal-400" :
                worker.activity === "Running" ? "text-amber-400" :
                worker.activity === "Fall" ? "text-red-400" : "text-slate-400"
              }`}>{worker.activity}</span>
            </div>
          )}
        </div>
      </div>

      {/* Current sensor snapshot */}
      {latestReading && (
        <div className="rounded-2xl border border-border/30 overflow-hidden shadow-card"
          style={{ background: "linear-gradient(180deg, #0f1f35 0%, #0a1628 100%)" }}
        >
          <div className="px-4 py-3 border-b border-border/20  flex items-center gap-2">
            <Activity size={13} className="text-primary" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Current Readings</span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-border/20">
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Wind size={12} className="text-slate-500" />
                <span className="text-[11px] text-slate-500 uppercase tracking-wide">Gas Level</span>
              </div>
              <GasIndicator level={latestReading.gas_level} />
              <p className="text-[10px] text-slate-600 mt-1">Avg (5): {avgGas} ppm</p>
            </div>
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Thermometer size={12} className="text-slate-500" />
                <span className="text-[11px] text-slate-500 uppercase tracking-wide">Temperature</span>
              </div>
              <p className={`text-lg font-bold font-mono ${latestReading.temperature > 40 ? "text-warning" : "text-slate-200"}`}>
                {latestReading.temperature.toFixed(1)}<span className="text-sm font-normal text-slate-500">°C</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mini Map */}
      {worker.last_lat != null && worker.last_lng != null && (
        <div className="rounded-2xl border border-border/30 overflow-hidden shadow-card">
          <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2"
            style={{ background: "linear-gradient(180deg, #0f1f35 0%, #0a1628 100%)" }}
          >
            <MapPin size={13} className="text-primary" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Last Known Location</span>
            <span className="ml-auto text-[10px] font-mono text-slate-500">
              {worker.last_lat.toFixed(5)}, {worker.last_lng.toFixed(5)}
            </span>
          </div>
          <div style={{ height: "200px" }}>
            <WorkerMap workers={[worker as any]} focusWorkerId={worker.worker_id} className="h-full" />
          </div>
        </div>
      )}

      {/* Sensor history table */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Clock size={13} className="text-slate-500" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sensor History</span>
          <span className="text-[10px] text-slate-600 ml-auto">Last {history.length} readings</span>
        </div>

        <div className="rounded-2xl border border-border/30 overflow-hidden"
          style={{ background: "linear-gradient(180deg, #0f1f35 0%, #0a1628 100%)" }}
        >
          {/* Table header */}
          <div className="grid grid-cols-4 px-3.5 py-2 border-b border-border/20 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            <span>Time</span>
            <span className="text-center">Gas</span>
            <span className="text-center">Temp</span>
            <span className="text-center">Fall</span>
          </div>

          <div className="divide-y divide-border/10 max-h-64 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-center text-slate-600 text-xs py-8">No readings yet</p>
            ) : history.map((r) => (
              <div key={r.id} className={`grid grid-cols-4 px-3.5 py-2.5 text-xs items-center
                ${r.fall_detected ? "bg-fall/5" : ""}
              `}>
                <span className="text-slate-500 font-mono text-[10px]">
                  {new Date(r.timestamp).toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className={`text-center font-semibold font-mono text-[11px] ${
                  r.gas_level > 300 ? "text-critical" : r.gas_level > 200 ? "text-warning" : "text-safe"
                }`}>
                  {r.gas_level}
                </span>
                <span className={`text-center font-mono text-[11px] ${r.temperature > 40 ? "text-warning" : "text-slate-400"}`}>
                  {r.temperature.toFixed(1)}°
                </span>
                <div className="flex justify-center">
                  {r.fall_detected ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-fall/20 text-fall border border-fall/30">FALL</span>
                  ) : (
                    <span className="text-slate-600 text-[10px]">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
