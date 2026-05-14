"use client";

import { useEffect, useRef } from "react";
import type { Worker } from "@/components/WorkerCard";

// Status → Leaflet marker color
const STATUS_COLOR: Record<string, string> = {
  SAFE: "#22c55e",
  WARNING: "#f59e0b",
  CRITICAL: "#ef4444",
  FALL: "#dc2626",
  INACTIVE: "#64748b",
  GEO_VIOLATION: "#d946ef",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface WorkerMapProps {
  workers: Worker[];
  /** Single mini-map mode: zoom directly to this worker */
  focusWorkerId?: string;
  className?: string;
}

export default function WorkerMap({ workers, focusWorkerId, className = "" }: WorkerMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    // Leaflet must be loaded client-side
    import("leaflet").then((L) => {
      if (!mapRef.current || leafletMapRef.current) return;

      // Fix Leaflet default icon paths (broken in Next.js)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current, {
        center: [20.5937, 78.9629], // India center
        zoom: 5,
        zoomControl: true,
        attributionControl: false,
      });

      leafletMapRef.current = map;

      // Light tile layer
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 19 }
      ).addTo(map);

      // Disable double-click zoom to allow our custom Safe Zone interaction
      map.doubleClickZoom.disable();
      
      // Interactive Geofence Editor
      map.on('dblclick', (e: any) => {
        const radius = Number(prompt("🔒 Configure Safe Zone\n\nEnter restricted radius (meters):", "50"));
        if (!radius) return;
        
        fetch(`${API_URL}/geofence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: e.latlng.lat, lng: e.latlng.lng, radius, enabled: true })
        }).then(() => window.location.reload());
      });

      // Load active Geofence
      fetch(`${API_URL}/geofence`)
        .then(r => r.json())
        .then(data => {
          if (data.enabled && data.lat) {
            L.circle([data.lat, data.lng], {
              color: '#d946ef',
              fillColor: '#d946ef',
              fillOpacity: 0.1,
              weight: 2,
              radius: data.radius,
              dashArray: '6, 6'
            }).addTo(map).bindPopup(
              `<div style="color:#d946ef;font-weight:700;">Safe Zone (${Math.round(data.radius)}m)</div><div style="font-size:10px;color:#64748b">Manage in Settings tab.</div>`,
              { className: 'light-popup' }
            );
          }
        }).catch(err => console.error("Geofence load error:", err));
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markersRef.current.clear();
      }
    };
  }, []);

  // Update markers when workers change
  useEffect(() => {
    if (!leafletMapRef.current) return;

    import("leaflet").then((L) => {
      const map = leafletMapRef.current;
      const gpsWorkers = workers.filter(
        (w) => w.last_lat != null && w.last_lng != null
      );

      // Remove stale markers
      markersRef.current.forEach((marker, id) => {
        if (!gpsWorkers.find((w) => w.worker_id === id)) {
          map.removeLayer(marker);
          markersRef.current.delete(id);
        }
      });

      // Add / update markers
      gpsWorkers.forEach((worker) => {
        const lat = worker.last_lat!;
        const lng = worker.last_lng!;
        const color = STATUS_COLOR[worker.status] ?? "#64748b";

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="
              width:36px; height:36px; border-radius:50% 50% 50% 0;
              background:${color}; border:2px solid rgba(255,255,255,0.8);
              transform:rotate(-45deg); box-shadow:0 0 12px ${color}88;
              display:flex; align-items:center; justify-content:center;
            ">
              <div style="
                transform:rotate(45deg);
                color:white; font-size:10px; font-weight:700;
                text-shadow:0 1px 2px rgba(0,0,0,0.8); margin-top:-2px;
              ">
                ${worker.status === "FALL" ? "⚠" : worker.status[0]}
              </div>
            </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
          popupAnchor: [0, -40],
        });

        const popupContent = `
          <div style="font-family:Inter,sans-serif; min-width:160px;">
            <div style="font-weight:700; color:${color}; font-size:13px;">${worker.name}</div>
            <div style="color:#64748b; font-size:11px; margin-top:2px; font-family:monospace;">${worker.worker_id}</div>
            <div style="margin-top:6px; padding:4px 8px; border-radius:6px; background:${color}15; border:1px solid ${color}44; display:inline-block;">
              <span style="color:${color}; font-weight:700; font-size:11px;">${worker.status}</span>
            </div>
            <div style="color:#64748b; font-size:10px; margin-top:6px;">
              ${lat.toFixed(5)}, ${lng.toFixed(5)}
            </div>
          </div>`;

        const existing = markersRef.current.get(worker.worker_id);
        if (existing) {
          existing.setLatLng([lat, lng]);
          existing.setIcon(icon);
          existing.setPopupContent(popupContent);
        } else {
          const marker = L.marker([lat, lng], { icon })
            .addTo(map)
            .bindPopup(popupContent, {
              className: "light-popup",
              maxWidth: 220,
            });
          markersRef.current.set(worker.worker_id, marker);
        }
      });

      // Auto-fit or focus
      if (focusWorkerId) {
        const focused = gpsWorkers.find((w) => w.worker_id === focusWorkerId);
        if (focused?.last_lat && focused?.last_lng) {
          map.setView([focused.last_lat, focused.last_lng], 15, { animate: true });
        }
      } else if (gpsWorkers.length > 0 && markersRef.current.size > 0) {
        const group = L.featureGroup(Array.from(markersRef.current.values()));
        map.fitBounds(group.getBounds().pad(0.3), { maxZoom: 14 });
      }
    });
  }, [workers, focusWorkerId]);

  return (
    <>
      <style>{`
        .light-popup .leaflet-popup-content-wrapper {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          color: #0f172a;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1);
        }
        .light-popup .leaflet-popup-tip {
          background: #ffffff;
        }
        .light-popup .leaflet-popup-close-button {
          color: #64748b !important;
        }
        .leaflet-control-zoom a {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          color: #0f172a !important;
        }
        .leaflet-control-zoom a:hover {
          background: #f8fafc !important;
        }
      `}</style>
      <div ref={mapRef} className={`w-full rounded-2xl overflow-hidden ${className}`} />
    </>
  );
}
