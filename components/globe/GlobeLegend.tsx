"use client";

import { useGeocore } from "@/store/useGeocore";
import { compassPoint, getDemoImpact } from "@/lib/demo/fakeAQI";

/**
 * Bottom-left key for the globe — demo mode only.
 *
 * Nothing on the globe said what the orange curves were. This names the three
 * marks a viewer sees, and when a fire is selected it adds a compass showing
 * the plume bearing, so the panel's word "downwind" has something to point at.
 *
 * `pointer-events-none` throughout: the legend sits over the canvas and must
 * not swallow drags, clicks or wheel events meant for the globe.
 */
export default function GlobeLegend() {
  const selectedFire = useGeocore((s) => s.selectedFire);
  const impact = selectedFire ? getDemoImpact(selectedFire) : null;

  return (
    <div className="absolute bottom-3 left-3 z-10 pointer-events-none select-none">
      <div className="border border-[#262626] bg-[#0a0a0a]/85 px-2.5 py-2 space-y-1.5">
        <div className="font-mono text-[8px] tracking-widest uppercase text-[#525252]">
          Key
        </div>

        <LegendRow label="modelled smoke path">
          <span
            className="block w-4 h-[3px] rounded-full"
            style={{
              backgroundColor: "#FF8A3D",
              boxShadow: "0 0 4px 1px rgba(255,138,61,0.7)",
            }}
          />
        </LegendRow>

        <LegendRow label="wildfire detection">
          <span
            className="block w-2 h-2 rounded-full"
            style={{
              backgroundColor: "#FF3D00",
              border: "1px solid #FFD6A0",
            }}
          />
        </LegendRow>

        <LegendRow label="air quality station">
          <span
            className="block w-2 h-2 rounded-full"
            style={{
              backgroundColor: "#8F3F97",
              border: "1px solid rgba(255,255,255,0.85)",
            }}
          />
        </LegendRow>

        {impact && (
          <div className="pt-1.5 mt-0.5 border-t border-[#262626] flex items-center gap-2">
            {/* A compass diagram, not a screen-aligned arrow: the camera's
                heading changes with every preset, so an arrow drawn relative to
                the screen would be lying half the time. N marks the rose. */}
            <CompassRose bearingDeg={impact.downwindBearingDeg} />
            <div>
              <div className="font-mono text-[8px] tracking-widest uppercase text-[#525252]">
                Smoke drifting
              </div>
              <div className="font-mono text-[10px] text-[#e5e5e5]">
                {compassPoint(impact.downwindBearingDeg)} ·{" "}
                {Math.round(impact.downwindBearingDeg)}°
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LegendRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 flex justify-center shrink-0">{children}</span>
      <span className="font-mono text-[9px] text-[#a3a3a3]">{label}</span>
    </div>
  );
}

function CompassRose({ bearingDeg }: { bearingDeg: number }) {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <circle cx="15" cy="15" r="11" fill="none" stroke="#262626" />
      <text
        x="15"
        y="6.5"
        textAnchor="middle"
        fontSize="6"
        fill="#737373"
        fontFamily="ui-monospace, monospace"
      >
        N
      </text>
      <g transform={`rotate(${bearingDeg} 15 15)`}>
        {/* Points "up" at 0deg, which the rose labels as north. */}
        <line
          x1="15"
          y1="17"
          x2="15"
          y2="8"
          stroke="#FF8A3D"
          strokeWidth="1.5"
        />
        <polygon points="15,5.5 12.4,10 17.6,10" fill="#FF8A3D" />
      </g>
      <circle cx="15" cy="15" r="1.3" fill="#737373" />
    </svg>
  );
}
