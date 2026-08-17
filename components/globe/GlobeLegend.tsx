"use client";

import { useGeocore } from "@/store/useGeocore";
import { compassPoint, getDemoImpact } from "@/lib/demo/fakeAQI";
import { AQI_BANDS } from "@/lib/aqiScale";

// The EPA ramp, as a CSS gradient, taken from the same table the globe colours
// stations with. Written once and reused by the swatch and the strip so the two
// cannot drift apart, and so neither can drift from what is actually drawn.
const AQI_GRADIENT = `linear-gradient(90deg, ${AQI_BANDS.map(
  (band) => band.color
).join(", ")})`;

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

        {/* Solid, unringed — matching FireLayer, where every unselected
            detection lost its pale halo. The old swatch still advertised a
            1px #FFD6A0 ring that no marker on the globe carries. */}
        <LegendRow label="wildfire detection">
          <span
            className="block w-2 h-2 rounded-full"
            style={{ backgroundColor: "#FF4E00" }}
          />
        </LegendRow>

        {/* Stations are drawn as numbered discs coloured by aqiToColor, so the
            swatch is one too: a disc carrying the whole ramp, so it cannot
            claim a fixed colour the globe does not use, with a digit to say the
            numbers are part of the mark. The strip underneath names the ramp's
            ends. "numbered" is there because a bare digit does not say it means
            anything; which number is which is self-evident from the panel,
            which lists the stations in the same order with the same discs. */}
        <LegendRow label="air quality station, numbered">
          <span
            className="block w-4 h-4 rounded-full font-mono text-[8px] font-bold leading-none flex items-center justify-center"
            style={{
              backgroundImage: AQI_GRADIENT,
              boxShadow: "0 0 0 1px rgba(255,255,255,0.85)",
              color: "#111111",
            }}
          >
            1
          </span>
        </LegendRow>

        <AQIScaleStrip />

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

/**
 * The EPA ramp under the station row, indented to start where the labels do
 * (w-4 icon column + gap-2 = 24px). Discrete bands rather than a smooth
 * gradient, because the scale itself is banded — a continuous wash would imply
 * the colour interpolates, which it does not.
 */
function AQIScaleStrip() {
  return (
    <div className="pl-6">
      <div className="flex w-[92px] h-[3px]">
        {AQI_BANDS.map((band) => (
          <span
            key={band.upperAqi}
            className="flex-1"
            style={{ backgroundColor: band.color }}
          />
        ))}
      </div>
      <div className="flex w-[92px] justify-between font-mono text-[7px] text-[#525252] mt-0.5">
        <span>good</span>
        <span>hazardous</span>
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
