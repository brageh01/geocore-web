"use client";

import { useGeocore } from "@/store/useGeocore";
import { DEMO_MODE } from "@/lib/demo/flag";
import ImpactBriefing from "./ImpactBriefing";

export default function EventCard() {
  const fire = useGeocore((s) => s.selectedFire);
  const setSelectedFire = useGeocore((s) => s.setSelectedFire);

  if (!fire) return null;

  // Demo mode swaps the raw VIIRS field list below for a briefing. The rows
  // stay exactly as they were for the live path.
  if (DEMO_MODE) return <ImpactBriefing fire={fire} />;

  const lonLabel =
    fire.longitude >= 0
      ? `${fire.longitude.toFixed(4)}°E`
      : `${Math.abs(fire.longitude).toFixed(4)}°W`;
  const latLabel =
    fire.latitude >= 0
      ? `${fire.latitude.toFixed(4)}°N`
      : `${Math.abs(fire.latitude).toFixed(4)}°S`;

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-[10px] font-bold tracking-widest text-[#FF4500] uppercase">
          Fire Event
        </h2>
        <button
          onClick={() => setSelectedFire(null)}
          className="font-mono text-[10px] text-[#737373] hover:text-[#e5e5e5] transition-colors"
        >
          CLOSE
        </button>
      </div>

      <div className="space-y-2">
        <DataRow label="ID" value={fire.id} />
        <DataRow label="Location" value={`${latLabel}, ${lonLabel}`} />
        <DataRow label="Brightness" value={`${fire.brightness.toFixed(1)} K`} />
        <DataRow label="FRP" value={`${fire.frp.toFixed(1)} MW`} />
        <DataRow label="Confidence" value={fire.confidence} />
        <DataRow label="Satellite" value={fire.satellite} />
        <DataRow label="Acquired" value={`${fire.acq_date} ${fire.acq_time}`} />
        <DataRow
          label="Day/Night"
          value={fire.daynight === "D" ? "Day" : "Night"}
        />
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline border-b border-[#1a1a1a] pb-1">
      <span className="font-mono text-[10px] text-[#737373] uppercase tracking-wide">
        {label}
      </span>
      <span className="font-mono text-xs text-[#e5e5e5]">{value}</span>
    </div>
  );
}
