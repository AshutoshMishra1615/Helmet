"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";
const RECONNECT_DELAY_MS = 3000;

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";

export interface WorkerUpdate {
  worker_id: string;
  name: string;
  status: "SAFE" | "WARNING" | "CRITICAL" | "FALL" | "INACTIVE" | "GEO_VIOLATION";
  gas_level: number;
  fall_detected: boolean;
  temperature: number;
  fall_acknowledged: boolean;
  anomaly_predicted?: boolean;
  activity?: string;
  timestamp: string;
  // GPS fields
  latitude?: number | null;
  longitude?: number | null;
  gps_valid?: boolean;
}

interface UseWebSocketReturn {
  lastUpdate: WorkerUpdate | null;
  connectionStatus: ConnectionStatus;
  allUpdates: WorkerUpdate[];
}

export function useWebSocket(): UseWebSocketReturn {
  const [lastUpdate, setLastUpdate] = useState<WorkerUpdate | null>(null);
  const [allUpdates, setAllUpdates] = useState<WorkerUpdate[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus((prev) =>
      prev === "connected" ? "reconnecting" : "connecting"
    );

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnectionStatus("connected");
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data: WorkerUpdate = JSON.parse(event.data);
        setLastUpdate(data);
        // Keep a rolling buffer of the last 20 updates for live-feed
        setAllUpdates((prev) => [data, ...prev].slice(0, 20));
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnectionStatus("reconnecting");
      retryTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  // Initial connect + visibility-based reconnect
  useEffect(() => {
    mountedRef.current = true;
    connect();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (wsRef.current?.readyState !== WebSocket.OPEN) connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { lastUpdate, connectionStatus, allUpdates };
}
