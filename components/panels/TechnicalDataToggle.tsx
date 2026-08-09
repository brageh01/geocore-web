"use client";

import { useGeocore } from "@/store/useGeocore";

/**
 * The single control governing both panels' TECHNICAL DATA sections.
 *
 * One switch rather than one per panel: the two would otherwise disagree, and a
 * viewer who opened the detail on one panel would be surprised the other stayed
 * collapsed. State lives in the store, so it survives selecting a different
 * fire and resets on reload.
 */
export default function TechnicalDataToggle() {
  const showTechnical = useGeocore((s) => s.showTechnicalData);
  const toggleTechnical = useGeocore((s) => s.toggleTechnicalData);

  return (
    <button
      onClick={toggleTechnical}
      aria-expanded={showTechnical}
      className="w-full flex items-center justify-between gap-2 px-1.5 py-1 border border-[#262626] hover:border-[#404040] transition-colors"
    >
      <span className="font-mono text-[9px] tracking-widest uppercase text-[#737373]">
        Technical data
      </span>
      <span className="font-mono text-[9px] text-[#525252]">
        {showTechnical ? "HIDE" : "SHOW"}
      </span>
    </button>
  );
}
