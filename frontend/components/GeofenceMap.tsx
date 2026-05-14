"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

interface GeofenceMapProps {
  lat: number;
  lng: number;
  radius: number;
  enabled: boolean;
  onMapClick: (lat: number, lng: number) => void;
}

export default function GeofenceMap({ lat, lng, radius, enabled, onMapClick }: GeofenceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: L.LatLngExpression = lat && lng ? [lat, lng] : [22.2527, 84.9088];
    const map = L.map(containerRef.current, {
      center,
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Add zoom control (top-right)
    L.control.zoom({ position: "topright" }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker + circle when config changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
    if (circleRef.current) { circleRef.current.remove(); circleRef.current = null; }

    if (!lat && !lng) return;

    // Center marker
    markerRef.current = L.circleMarker([lat, lng], {
      radius: 6,
      color: enabled ? "#22c55e" : "#64748b",
      fillColor: enabled ? "#22c55e" : "#94a3b8",
      fillOpacity: 0.9,
      weight: 2,
    }).addTo(map);

    // Radius circle
    if (enabled) {
      circleRef.current = L.circle([lat, lng], {
        radius,
        color: "#22c55e",
        fillColor: "#22c55e",
        fillOpacity: 0.08,
        weight: 2,
        dashArray: "6 4",
      }).addTo(map);
    }

    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, radius, enabled]);

  return <div ref={containerRef} className="h-full w-full" />;
}
