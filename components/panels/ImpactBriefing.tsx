"use client";

import { useGeocore } from "@/store/useGeocore";
import { aqiCategory, aqiToColor } from "@/lib/aqiScale";
import {
  BASELINE_PM25_UGM3,
  formatAcqTime,
  getDemoImpact,
} from "@/lib/demo/fakeAQI";
import type { FireEvent } from "@/lib/contracts";

/**
 * The EVENT DATA panel in demo mode: a briefing rather than a telemetry dump.
 *
 * The lead is the consequence — how far above a clean-air baseline the worst
 * downwind station is reading — because that is the claim the product exists to
 * make. The satellite fields that used to fill this panel are demoted to a
 * footer, since "which VIIRS pass saw it" is provenance, not a finding.
 */
export default function ImpactBriefing({ fire }: { fire: FireEvent }) {
  const setSelectedFire = useGeocore((s) => s.setSelectedFire);
  const impact = getDemoImpact(fire);
  const { worst, stations } = impact;
  const worstColor = aqiToColor(worst.aqi);

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-mono text-[10px] font-bold tracking-widest text-[#FF4500] uppercase">
          Impact Assessment
        </h2>
        <button
          onClick={() => setSelectedFire(null)}
          className="font-mono text-[10px] text-[#737373] hover:text-[#e5e5e5] transition-colors"
        >
          CLOSE
        </button>
      </div>

      {/* Headline — the whole point of the panel. */}
      <div className="mb-4">
        <div
          className="font-mono font-bold leading-none tracking-tight"
          style={{ color: worstColor, fontSize: "44px" }}
        >
          {worst.baselineMultiplier.toFixed(1)}x
        </div>
        <div className="font-mono text-[11px] text-[#a3a3a3] mt-1.5 uppercase tracking-wider">
          baseline PM2.5
        </div>
        <div className="font-mono text-[10px] text-[#737373] mt-0.5">
          against {BASELINE_PM25_UGM3} µg/m³ clean-air reference
        </div>
      </div>

      {/* Worst-hit station. */}
      <div
        className="border-l-2 pl-2.5 py-1.5 mb-4"
        style={{ borderColor: worstColor }}
      >
        <div className="font-mono text-[10px] text-[#737373] uppercase tracking-wide mb-1">
          Worst hit
        </div>
        <div className="font-mono text-sm text-[#e5e5e5] leading-tight">
          {worst.name}
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span
            className="font-mono text-lg font-bold"
            style={{ color: worstColor }}
          >
            {worst.pm25.toFixed(1)}
          </span>
          <span className="font-mono text-[10px] text-[#a3a3a3]">µg/m³</span>
          <span
            className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5"
            style={{ color: worstColor, border: `1px solid ${worstColor}66` }}
          >
            {aqiCategory(worst.aqi)}
          </span>
        </div>
        <div className="font-mono text-[10px] text-[#737373] mt-1">
          {worst.distanceKm.toFixed(0)} km downwind · AQI {worst.aqi}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <BriefingRow
          label="Stations affected"
          value={`${stations.length}`}
        />
        <BriefingRow label="Source FRP" value={`${fire.frp.toFixed(1)} MW`} />
        <BriefingRow
          label="Detected"
          value={`${fire.acq_date} ${formatAcqTime(fire.acq_time)} UTC`}
        />
      </div>

      {/* Every station, nearest first. */}
      <div className="mb-4">
        <div className="font-mono text-[10px] font-bold tracking-widest text-[#737373] uppercase mb-2">
          Downwind Stations
        </div>
        <div className="space-y-1">
          {stations.map((station) => {
            const color = aqiToColor(station.aqi);
            return (
              <div
                key={station.id}
                className="flex items-center justify-between gap-2 border-b border-[#1a1a1a] pb-1"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-1.5 h-1.5 shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-mono text-[11px] text-[#e5e5e5] truncate">
                    {station.name}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 shrink-0">
                  <span className="font-mono text-[9px] text-[#737373]">
                    {station.distanceKm.toFixed(0)}km
                  </span>
                  <span
                    className="font-mono text-[11px] tabular-nums"
                    style={{ color }}
                  >
                    {station.pm25.toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Provenance, demoted. */}
      <div className="border-t border-[#1a1a1a] pt-2 space-y-1">
        <FooterRow
          label="Source"
          value={`VIIRS ${fire.satellite} · ${
            fire.daynight === "D" ? "Day" : "Night"
          }`}
        />
        <FooterRow
          label="Position"
          value={`${fire.latitude.toFixed(3)}, ${fire.longitude.toFixed(3)}`}
        />
        <FooterRow
          label="Brightness"
          value={`${fire.brightness.toFixed(1)} K`}
        />
      </div>
    </div>
  );
}

function BriefingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline border-b border-[#1a1a1a] pb-1">
      <span className="font-mono text-[10px] text-[#737373] uppercase tracking-wide">
        {label}
      </span>
      <span className="font-mono text-xs text-[#e5e5e5]">{value}</span>
    </div>
  );
}

function FooterRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="font-mono text-[9px] text-[#525252] uppercase tracking-wide">
        {label}
      </span>
      <span className="font-mono text-[9px] text-[#737373]">{value}</span>
    </div>
  );
}
