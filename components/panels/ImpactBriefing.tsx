"use client";

import { useMemo } from "react";
import { useGeocore } from "@/store/useGeocore";
import {
  AQI_BANDS,
  aqiCategoryName,
  aqiCategoryPhrase,
  aqiToBadgeTextColor,
  aqiToColor,
  aqiToTextColor,
} from "@/lib/aqiScale";
import {
  BASELINE_PM25_UGM3,
  formatAcqTime,
  getDemoImpact,
} from "@/lib/demo/fakeAQI";
import {
  clusterFireEventsCached,
  findClusterForFire,
} from "@/lib/demo/fireClusters";
import TechnicalDataToggle from "@/components/panels/TechnicalDataToggle";
import type { FireEvent } from "@/lib/contracts";

/**
 * The EVENT DATA panel in demo mode.
 *
 * Written for someone who has never seen an AQI number. The default state
 * carries no unit a layperson does not already know: the lead is a sentence,
 * the headline is a multiple of clean air, and every station carries a plain
 * category name beside its reading. Everything that needs a domain to
 * interpret — radiative power, brightness temperature, sensor and overpass —
 * sits behind the TECHNICAL DATA toggle, collapsed by default.
 */
export default function ImpactBriefing({ fire }: { fire: FireEvent }) {
  const setSelectedFire = useGeocore((s) => s.setSelectedFire);
  const fires = useGeocore((s) => s.fires);
  const showTechnical = useGeocore((s) => s.showTechnicalData);

  const impact = getDemoImpact(fire);
  const { worst, stations } = impact;
  // Swatches use the true EPA colour; type uses the lifted variant.
  const worstTextColor = aqiToTextColor(worst.aqi);

  // Only needed for the technical section, but cheap: the clustering is cached
  // on the fires array identity and shared with the active-events list.
  const cluster = useMemo(
    () => findClusterForFire(clusterFireEventsCached(fires), fire),
    [fires, fire]
  );

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
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

      {/* 1 — the whole finding, in one sentence. */}
      <p className="text-[13px] leading-relaxed text-[#e5e5e5] mb-4">
        Smoke from this fire is reaching{" "}
        <span className="font-semibold">{worst.name}</span>,{" "}
        {worst.distanceKm.toFixed(0)} km downwind. The air there is{" "}
        <span className="font-semibold" style={{ color: worstTextColor }}>
          {worst.baselineMultiplier.toFixed(1)} times dirtier
        </span>{" "}
        than clean air — {aqiCategoryPhrase(worst.aqi)}.
      </p>

      {/* 2 — the headline, labelled so it stands on its own. */}
      <div className="mb-4">
        <div
          className="font-mono font-bold leading-none tracking-tight"
          style={{ color: worstTextColor, fontSize: "40px" }}
        >
          {worst.baselineMultiplier.toFixed(1)}x
        </div>
        <div className="font-mono text-[11px] text-[#a3a3a3] mt-1.5">
          dirtier than clean air
        </div>
        <div className="font-mono text-[9px] text-[#737373] mt-0.5">
          clean air reference: {BASELINE_PM25_UGM3} µg/m³
        </div>
      </div>

      {/* 3 — every station, nearest first, each with a category in words. The
          leading number is the same badge the globe draws on that station, in
          the same order and the same colour, so a viewer can go from a disc on
          the map to its row here without reading a name off either. */}
      <div className="mb-4">
        <div className="font-mono text-[10px] font-bold tracking-widest text-[#737373] uppercase mb-2">
          Air quality downwind
        </div>
        <div className="space-y-1.5">
          {stations.map((station, index) => {
            const swatch = aqiToColor(station.aqi);
            const text = aqiToTextColor(station.aqi);
            return (
              <div
                key={station.id}
                className="border-b border-[#1a1a1a] pb-1.5 last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-baseline gap-1.5 min-w-0">
                    <StationBadge index={index + 1} aqi={station.aqi} />
                    <span className="font-mono text-[11px] text-[#e5e5e5] truncate">
                      {station.name}
                    </span>
                  </span>
                  <span className="font-mono text-[9px] text-[#737373] shrink-0">
                    {station.distanceKm.toFixed(0)} km away
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span
                    className="w-1.5 h-1.5 shrink-0 translate-y-[-1px]"
                    style={{ backgroundColor: swatch }}
                  />
                  <span
                    className="font-mono text-[11px] tabular-nums"
                    style={{ color: text }}
                  >
                    {station.pm25.toFixed(1)}
                  </span>
                  <span className="font-mono text-[9px] text-[#737373]">
                    µg/m³
                  </span>
                  <span className="font-mono text-[9px]" style={{ color: text }}>
                    {aqiCategoryName(station.aqi)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4 — what the colours mean. */}
      <div className="mb-3">
        <div className="font-mono text-[9px] tracking-widest text-[#737373] uppercase mb-1.5">
          Air quality scale
        </div>
        <div className="flex gap-px">
          {AQI_BANDS.map((band) => (
            <div key={band.upperAqi} className="flex-1 min-w-0">
              <div className="h-1.5" style={{ backgroundColor: band.color }} />
              <div className="font-mono text-[7px] leading-tight text-[#737373] mt-1 break-words">
                {band.name}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5 — the one unit that survives into the default view. */}
      <p className="font-mono text-[9px] leading-relaxed text-[#525252] mb-3">
        PM2.5 — fine smoke particles, micrograms per cubic metre.
      </p>

      <TechnicalDataToggle />

      {showTechnical && (
        <div className="mt-2 space-y-1 border-t border-[#1a1a1a] pt-2">
          <TechnicalRow
            label="Source FRP"
            value={`${fire.frp.toFixed(1)} MW`}
          />
          <TechnicalRow
            label="Brightness"
            value={`${fire.brightness.toFixed(1)} K`}
          />
          <TechnicalRow
            label="Position"
            value={`${fire.latitude.toFixed(3)}, ${fire.longitude.toFixed(3)}`}
          />
          <TechnicalRow
            label="Detections in cluster"
            value={cluster ? String(cluster.detectionCount) : "1"}
          />
          <TechnicalRow label="Sensor" value={sensorName(fire.satellite)} />
          <TechnicalRow
            label="Overpass"
            value={fire.daynight === "D" ? "Daytime" : "Night-time"}
          />
          <TechnicalRow
            label="Detected"
            value={`${fire.acq_date} ${formatAcqTime(fire.acq_time)} UTC`}
          />
        </div>
      )}
    </div>
  );
}

/**
 * The station's index, drawn as the same disc the globe puts on it.
 *
 * Deliberately not a plain "1." — matching the globe's mark exactly is what
 * makes the pairing readable at a glance, and the AQI fill means the row
 * carries the same colour cue the disc does.
 */
function StationBadge({ index, aqi }: { index: number; aqi: number }) {
  return (
    <span
      className="shrink-0 w-[15px] h-[15px] rounded-full flex items-center justify-center font-mono text-[9px] font-bold leading-none self-center"
      style={{
        backgroundColor: aqiToColor(aqi),
        color: aqiToBadgeTextColor(aqi),
        boxShadow: "0 0 0 1px rgba(255,255,255,0.55)",
      }}
    >
      {index}
    </span>
  );
}

/** FIRMS reports the VIIRS platform as a single character. */
function sensorName(satellite: string): string {
  if (satellite === "N") return "VIIRS · Suomi NPP";
  if (satellite === "1") return "VIIRS · NOAA-20";
  return `VIIRS · ${satellite}`;
}

function TechnicalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="font-mono text-[9px] text-[#525252] uppercase tracking-wide shrink-0">
        {label}
      </span>
      <span className="font-mono text-[9px] text-[#a3a3a3] text-right">
        {value}
      </span>
    </div>
  );
}
