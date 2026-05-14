"use client";

import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const STORAGE_KEY = "helmet_unacked_falls";

export interface FallAlert {
  worker_id: string;
  name: string;
  triggered_at: string;        // ISO timestamp when fall first detected
  gas_level: number;
  acknowledged: boolean;
}

interface UseFallAlertsReturn {
  fallAlerts: FallAlert[];
  acknowledgeAlert: (worker_id: string) => Promise<void>;
  hasCriticalAlerts: boolean;
}

/** Persist/restore active fall alerts across page refreshes via sessionStorage */
function loadFromSession(): FallAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveToSession(alerts: FallAlert[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch { /* quota exceeded — ignore */ }
}

export function useFallAlerts(): UseFallAlertsReturn {
  const [fallAlerts, setFallAlerts] = useState<FallAlert[]>(() => loadFromSession());
  const { lastUpdate } = useWebSocket();

  // Sync to sessionStorage on every change
  useEffect(() => { saveToSession(fallAlerts); }, [fallAlerts]);

  // React to incoming WebSocket messages
  useEffect(() => {
    if (!lastUpdate) return;

    const { worker_id, name, status, gas_level, timestamp, fall_acknowledged } = lastUpdate;

    if (status === "FALL") {
      setFallAlerts((prev) => {
        const existing = prev.find((a) => a.worker_id === worker_id);
        if (existing && !existing.acknowledged) return prev; // already tracking
        // New OR re-triggered fall
        const newAlert: FallAlert = {
          worker_id,
          name: name ?? worker_id,
          triggered_at: timestamp,
          gas_level,
          acknowledged: false,
        };
        return [newAlert, ...prev.filter((a) => a.worker_id !== worker_id)];
      });
    }

    // If backend says fall_acknowledged = true, sync it here too
    if (fall_acknowledged) {
      setFallAlerts((prev) =>
        prev.map((a) => a.worker_id === worker_id ? { ...a, acknowledged: true } : a)
      );
    }
  }, [lastUpdate]);

  const acknowledgeAlert = useCallback(async (worker_id: string) => {
    try {
      await fetch(`${API_URL}/worker/${worker_id}/acknowledge-fall`, {
        method: "POST",
      });
    } catch { /* best-effort */ }
    setFallAlerts((prev) =>
      prev.map((a) => a.worker_id === worker_id ? { ...a, acknowledged: true } : a)
    );
  }, []);

  const hasCriticalAlerts = fallAlerts.some((a) => !a.acknowledged);

  return { fallAlerts, acknowledgeAlert, hasCriticalAlerts };
}
