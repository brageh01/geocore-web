"use client";

import { useMemo } from "react";
import { useGeocore } from "@/store/useGeocore";
import { getDemoImpact } from "@/lib/demo/fakeAQI";
import type { FireEvent } from "@/lib/contracts";

/**
 * The ACTIVE EVENTS panel in demo mode.
 *
 * The left sidebar was a static placeholder string. Now it lists the largest
 * detections by fire radiative power and selects one on click, which gives the
 * recording a way to drive the globe without hunting for a marker.
 */

// Enough to fill the column and imply a longer feed without scrolling forever.
const MAX_LISTED_EVENTS = 14;

// Mirrors the FRP ramp in FireLayer. Duplicated rather than imported because
// FireLayer pulls in Cesium at module scope, and this panel is rendered outside
// the `ssr: false` boundary that keeps Cesium out of the server render.
function cssColorForFrp(frp: number): string {
  if (frp >= 100) return "#FF1A00";
  if (frp >= 50) return "#FF3D00";
  if (frp >= 20) return "#FF6A00";
  if (frp >= 5) return "#FF8C1A";
  return "#FFB347";
}

export default function ActiveEventsList() {
  const fires = useGeocore((s) => s.fires);
  const selectedFire = useGeocore((s) => s.selectedFire);
  const setSelectedFire = useGeocore((s) => s.setSelectedFire);

  const topFires = useMemo(
    () =>
      [...fires].sort((a, b) => b.frp - a.frp).slice(0, MAX_LISTED_EVENTS),
    [fires]
  );

  if (topFires.length === 0) {
    return (
      <p className="text-xs text-[#737373] font-mono">Loading detections…</p>
    );
  }

  return (
    <div className="space-y-0.5">
      {topFires.map((fire) => (
        <EventRow
          key={fire.id}
          fire={fire}
          selected={selectedFire?.id === fire.id}
          onSelect={() => setSelectedFire(fire)}
        />
      ))}
    </div>
  );
}

function EventRow({
  fire,
  selected,
  onSelect,
}: {
  fire: FireEvent;
  selected: boolean;
  onSelect: () => void;
}) {
  const color = cssColorForFrp(fire.frp);
  // Same generator the globe and the briefing use, and it is cached by fire id,
  // so this costs nothing beyond a map lookup after the first render.
  const impact = getDemoImpact(fire);

  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-2 py-1.5 border-l-2 transition-colors"
      style={{
        borderColor: selected ? color : "transparent",
        backgroundColor: selected ? "#1a1a1a" : "transparent",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-1.5 h-1.5 shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="font-mono text-[11px] text-[#e5e5e5] tabular-nums">
            {fire.frp.toFixed(0)} MW
          </span>
        </div>
        <span
          className="font-mono text-[10px] tabular-nums shrink-0"
          style={{ color }}
        >
          {impact.worst.baselineMultiplier.toFixed(1)}x
        </span>
      </div>
      <div className="font-mono text-[9px] text-[#737373] mt-0.5 truncate">
        {formatCoords(fire.latitude, fire.longitude)}
      </div>
    </button>
  );
}

function formatCoords(latitude: number, longitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}
