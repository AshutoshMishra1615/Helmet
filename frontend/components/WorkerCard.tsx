"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle, CheckCircle2, Flame, WifiOff, User, Activity,
  Thermometer, Wind, CheckCheck, MapPin, BrainCircuit, ShieldOff
} from "lucide-react";
import { useFallAlerts } from "@/hooks/useFallAlerts";

export type WorkerStatus = "SAFE" | "WARNING" | "CRITICAL" | "FALL" | "INACTIVE" | "GEO_VIOLATION";

export interface Worker {
  worker_id: string;
  name: string;
  status: WorkerStatus;
  last_seen: string;
  fall_acknowledged: boolean;
  anomaly_predicted?: boolean;
  activity?: string;
  last_lat?: number | null;
  last_lng?: number | null;
}

interface WorkerCardProps {
  worker: Worker;
  latestGas?: number;
  latestTemp?: number;
}

const STATUS_CONFIG: Record<
  WorkerStatus,
  { label: string; color: string; textColor: string; strip: string; badge: string; icon: React.ReactNode; bg: string }
> = {
  SAFE: {
    label: "Safe",
    color: "border-safe/30",
    textColor: "text-safe",
    strip: "bg-safe",
    badge: "bg-safe/15 text-safe border border-safe/30",
    icon: <CheckCircle2 size={13} />,
    bg: "bg-gradient-safe",
  },
  WARNING: {
    label: "Warning",
    color: "border-warning/30",
    textColor: "text-warning",
    strip: "bg-warning",
    badge: "bg-warning/15 text-warning border border-warning/30",
    icon: <AlertTriangle size={13} />,
    bg: "bg-gradient-warning",
  },
  CRITICAL: {
    label: "Critical",
    color: "border-critical/30",
    textColor: "text-critical",
    strip: "bg-critical",
    badge: "bg-critical/15 text-critical border border-critical/30",
    icon: <Flame size={13} />,
    bg: "bg-gradient-danger",
  },
  FALL: {
    label: "Fall Detected!",
    color: "border-fall/50",
    textColor: "text-fall",
    strip: "bg-fall",
    badge: "bg-fall/15 text-fall border border-fall/40 status-pulse",
    icon: <AlertTriangle size={13} />,
    bg: "bg-gradient-fall",
  },
  INACTIVE: {
    label: "Inactive",
    color: "border-inactive/20",
    textColor: "text-inactive",
    strip: "bg-inactive",
    badge: "bg-inactive/15 text-inactive border border-inactive/30",
    icon: <WifiOff size={13} />,
    bg: "",
  },
  GEO_VIOLATION: {
    label: "Out of Bounds",
    color: "border-[#d946ef]/30",
    textColor: "text-[#d946ef]",
    strip: "bg-[#d946ef]",
    badge: "bg-[#d946ef]/15 text-[#d946ef] border border-[#d946ef]/30",
    icon: <ShieldOff size={13} />,
    bg: "bg-gradient-warning",
  },
};

function timeAgo(isoTimestamp: string): string {
  const diff = Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function GasBar({ level }: { level: number }) {
  // Max scale: 500 ppm
  const pct = Math.min(100, (level / 500) * 100);
  const color =
    level > 300 ? "#ef4444" :
    level > 200 ? "#f59e0b" :
    "#22c55e";

  return (
    <div className="flex items-center gap-2 flex-1">
      <Wind size={11} className="text-slate-500 shrink-0" />
      <div className="flex-1 gas-bar-track">
        <div
          className="gas-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span
        className="text-[11px] font-semibold font-mono tabular-nums shrink-0"
        style={{ color }}
      >
        {level}<span className="font-normal text-slate-500 ml-0.5">ppm</span>
      </span>
    </div>
  );
}

export default function WorkerCard({ worker, latestGas, latestTemp }: WorkerCardProps) {
  const cfg = STATUS_CONFIG[worker.status];
  const router = useRouter();
  const { acknowledgeAlert } = useFallAlerts();

  const isGeo = worker.status === "GEO_VIOLATION";
  const isCritical = worker.status === "CRITICAL";
  const isFall = worker.status === "FALL";
  const gasLevel = latestGas ?? 0;

  return (
    <div className={`relative group rounded-2xl border transition-all duration-300 card-lift cursor-pointer
      ${isFall ? "border-fall/40 bg-fall/5 hover:border-fall/60 glow-fall" :
        isCritical ? "border-critical/30 bg-critical/5 hover:border-critical/50" :
        isGeo ? "border-[#d946ef]/30 bg-[#d946ef]/5 hover:border-[#d946ef]/50" :
        "border-border/40 hover:border-border shadow-card hover:shadow-card-hover backdrop-blur-md"}`}
      style={{
        background: isFall || isCritical || isGeo ? undefined : "linear-gradient(180deg, rgba(15,31,53,0.8) 0%, rgba(10,22,40,0.9) 100%)"
      }}
      onClick={() => router.push(`/worker/${worker.worker_id}`)}
    >
      {/* Top status strip */}
      <div className={`h-1.5 w-full rounded-t-2xl transition-colors duration-500 ${
        isFall ? "bg-fall" :
        isCritical ? "bg-critical" :
        isGeo ? "bg-[#d946ef]" :
        worker.status === "WARNING" ? "bg-warning" :
        worker.status === "SAFE" ? "bg-safe" : "bg-inactive"
      }`} /> 
      
      <div className="flex-1 min-w-0 px-3.5 py-3">
        {/* Top row: avatar + name + badge */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Avatar */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border
            ${isFall ? "bg-fall/15 border-fall/40" :
              isCritical ? "bg-critical/15 border-critical/40" :
              isGeo ? "bg-[#d946ef]/15 border-[#d946ef]/40" :
              "bg-surface-3/50 border-border/50"}`}
          >
            <User size={24} className={
              isFall ? "text-fall" :
              isCritical ? "text-critical" :
              isGeo ? "text-[#d946ef]" : "text-slate-400"
            } />   </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-100 text-[14px] leading-tight truncate">
                {worker.name}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono tracking-wide">
                {worker.worker_id}
              </p>
            </div>
          </div>

          {/* Status badge */}
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${cfg.badge}`}>
            {cfg.icon}
            {cfg.label}
          </span>
        </div>

        {/* Gas level bar */}
        {(latestGas !== undefined || isCritical || isFall) && (
          <div className="mb-2.5">
            <GasBar level={gasLevel} />
          </div>
        )}

        {/* Bottom row: temp + GPS + last seen */}
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          {latestTemp !== undefined && (
            <span className="flex items-center gap-1">
              <Thermometer size={11} className={latestTemp > 40 ? "text-warning" : "text-slate-500"} />
              <span className={`font-semibold ${latestTemp > 40 ? "text-warning" : "text-slate-400"}`}>
                {latestTemp.toFixed(1)}°C
              </span>
            </span>
          )}
          {worker.last_lat != null && worker.last_lng != null && (
            <span className="flex items-center gap-1 text-primary/70">
              <MapPin size={10} />
              <span className="font-mono text-[10px]">
                {worker.last_lat.toFixed(4)}, {worker.last_lng.toFixed(4)}
              </span>
            </span>
          )}
          {worker.activity && worker.activity !== "Unknown" && (
            <span className={`flex items-center gap-1 ${
              worker.activity === "Idling" ? "activity-idling" :
              worker.activity === "Walking" ? "activity-walking" :
              worker.activity === "Running" ? "activity-running" :
              worker.activity === "Fall" ? "activity-fall" : "text-teal-400"
            }`}>
              <Activity size={10} />
              <span className="font-semibold text-[10px] tracking-wide uppercase">
                {worker.activity}
              </span>
            </span>
          )}
          <span className="ml-auto">{timeAgo(worker.last_seen)}</span>
        </div>

        {/* FALL persistent alert banner */}
        {isFall && !worker.fall_acknowledged && (
          <div
            className="mt-2.5 rounded-xl px-3 py-2 flex items-center gap-2 critical-flash border border-fall/30"
            onClick={(e) => e.stopPropagation()}
          >
            <AlertTriangle size={13} className="text-fall shrink-0" />
            <span className="text-[11px] text-fall font-bold flex-1">Worker fell — needs immediate help!</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                acknowledgeAlert(worker.worker_id);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-safe/15 border border-safe/30 text-safe text-[10px] font-bold hover:bg-safe/25 active:scale-95 transition-all"
            >
              <CheckCheck size={10} />
              ACK
            </button>
          </div>
        )}

        {/* CRITICAL gas banner */}
        {isCritical && (
          <div className="mt-2.5 rounded-xl px-3 py-1.5 flex items-center gap-2 bg-critical/10 border border-critical/25">
            <Flame size={12} className="text-critical shrink-0" />
            <span className="text-[11px] text-critical font-semibold">High gas/smoke detected — evacuate!</span>
          </div>
        )}

        {/* Geo Validation banner */}
        {isGeo && (
          <div className="mt-2.5 rounded-xl px-3 py-1.5 flex items-center gap-2 bg-[#d946ef]/10 border border-[#d946ef]/25">
            <ShieldOff size={12} className="text-[#d946ef] shrink-0" />
            <span className="text-[11px] text-[#d946ef] font-semibold">Worker has exited configured Safe Zone!</span>
          </div>
        )}

        {/* ML Anomaly banner */}
        {worker.anomaly_predicted && !isCritical && !isGeo && !isFall && (
          <div className="mt-2.5 rounded-xl px-3 py-1.5 flex items-center gap-2 bg-[#8b5cf6]/15 border border-[#8b5cf6]/30">
            <BrainCircuit size={12} className="text-[#a78bfa] shrink-0" />
            <span className="text-[11px] text-[#a78bfa] font-semibold">ML Anomaly: Gas rising rapidly</span>
          </div>
        )}
      </div>
    </div>
  );
}
