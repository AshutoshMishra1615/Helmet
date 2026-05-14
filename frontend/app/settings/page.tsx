"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Settings as SettingsIcon, MapPin, Save, Loader2, CheckCircle2,
  AlertCircle, ToggleLeft, ToggleRight, Radius, Navigation
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Dynamic import for Leaflet map (no SSR)
const GeofenceMap = dynamic(() => import("@/components/GeofenceMap"), {
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

interface GeofenceConfig {
  lat: number;
  lng: number;
  radius: number;
  enabled: boolean;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<GeofenceConfig>({
    lat: 0, lng: 0, radius: 50, enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/geofence`);
      if (res.ok) {
        const data: GeofenceConfig = await res.json();
        setConfig(data);
      }
    } catch {
      // use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${API_URL}/geofence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    setConfig((prev) => ({ ...prev, lat, lng }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #0ea5e922, #38bdf844)", border: "1px solid #38bdf822" }}
        >
          <SettingsIcon size={17} className="text-primary" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-100 leading-tight">Settings</h1>
          <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">
            Geofence · Safe Zone Configuration
          </p>
        </div>
      </div>

      {/* Success / Error banners */}
      {saved && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-safe/10 border border-safe/25 slide-down">
          <CheckCircle2 size={14} className="text-safe shrink-0" />
          <span className="text-sm text-safe font-medium">Geofence saved successfully!</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-critical/10 border border-critical/25 slide-down">
          <AlertCircle size={14} className="text-critical shrink-0" />
          <span className="text-sm text-critical font-medium">{error}</span>
        </div>
      )}

      {/* Enable toggle card */}
      <div className="rounded-2xl border border-border/40 overflow-hidden"
        style={{ background: "linear-gradient(180deg, #0f1f35 0%, #0a1628 100%)" }}
      >
        <div className="px-4 py-3.5 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-200">Enable Geofence</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Workers outside the safe zone will trigger a GEO_VIOLATION alert
            </p>
          </div>
          <button
            onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className="transition-transform active:scale-90"
          >
            {config.enabled ? (
              <ToggleRight size={36} className="text-safe" />
            ) : (
              <ToggleLeft size={36} className="text-slate-600" />
            )}
          </button>
        </div>
      </div>

      {/* Map picker */}
      <div className="rounded-2xl border border-border/40 overflow-hidden"
        style={{ background: "linear-gradient(180deg, #0f1f35 0%, #0a1628 100%)" }}
      >
        <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
          <MapPin size={13} className="text-primary" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Safe Zone Center
          </span>
          <span className="ml-auto text-[10px] text-slate-500 font-mono">
            Tap map to set center
          </span>
        </div>
        <div style={{ height: "250px" }}>
          <GeofenceMap
            lat={config.lat}
            lng={config.lng}
            radius={config.radius}
            enabled={config.enabled}
            onMapClick={handleMapClick}
          />
        </div>
      </div>

      {/* Coordinate inputs */}
      <div className="rounded-2xl border border-border/40 overflow-hidden"
        style={{ background: "linear-gradient(180deg, #0f1f35 0%, #0a1628 100%)" }}
      >
        <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
          <Navigation size={13} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Coordinates & Radius
          </span>
        </div>
        <div className="px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Latitude</label>
              <input
                id="geofence-lat"
                type="number"
                step="0.000001"
                value={config.lat}
                onChange={(e) => setConfig((prev) => ({ ...prev, lat: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-xl text-sm border border-border/35 text-slate-100 placeholder-slate-600 font-mono focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                style={{ background: "rgba(10, 22, 40, 0.8)" }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Longitude</label>
              <input
                id="geofence-lng"
                type="number"
                step="0.000001"
                value={config.lng}
                onChange={(e) => setConfig((prev) => ({ ...prev, lng: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-xl text-sm border border-border/35 text-slate-100 placeholder-slate-600 font-mono focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                style={{ background: "rgba(10, 22, 40, 0.8)" }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <Radius size={11} />
              Radius (meters)
            </label>
            <div className="flex items-center gap-3">
              <input
                id="geofence-radius"
                type="range"
                min="10"
                max="500"
                step="5"
                value={config.radius}
                onChange={(e) => setConfig((prev) => ({ ...prev, radius: parseFloat(e.target.value) }))}
                className="flex-1 accent-primary h-1.5"
              />
              <span className="text-sm font-bold font-mono text-primary w-16 text-right">
                {config.radius}m
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <button
        id="save-geofence-btn"
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg"
        style={{ background: "linear-gradient(135deg, #0369a1, #0ea5e9)" }}
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? "Saving…" : "Save Geofence Configuration"}
      </button>
    </div>
  );
}
