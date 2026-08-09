"use client";

import { useMemo } from "react";
import { useGeocore } from "@/store/useGeocore";
import { getDemoImpact } from "@/lib/demo/fakeAQI";
import {
  clusterFireEvents,
  findClusterForFire,
  type FireCluster,
} from "@/lib/demo/fireClusters";

/**
 * The ACTIVE EVENTS panel in demo mode.
 *
 * Lists fire *events*, not raw detections. One fire produces dozens of VIIRS
 * pixels a few kilometres apart, so the unclustered list repeated the same fire
 * down the column with near-identical coordinates and nothing but an FRP value
 * to tell the rows apart. Clicking an entry selects its strongest detection,
 * which drives the globe and the briefing panel exactly as before.
 */

const MAX_LISTED_EVENTS = 10;

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

  // Clustering 10k detections takes ~20ms, and `fires` is a stable reference in
  // demo mode, so this runs once for the session.
  const allEvents = useMemo(() => clusterFireEvents(fires), [fires]);

  // Which cluster the selection belongs to — matched by proximity, not by seed
  // id, because clicking a point on the globe usually picks a member detection
  // rather than the seed.
  const selectedCluster = useMemo(
    () => (selectedFire ? findClusterForFire(allEvents, selectedFire) : null),
    [allEvents, selectedFire]
  );

  const events = useMemo(() => {
    const top = allEvents.slice(0, MAX_LISTED_EVENTS);
    // A fire selected on the globe is often nowhere near the top by FRP — the
    // Nevada fire reached from the California preset sits far down the ranking.
    // Leaving the list unchanged made it look like the selection had no entry
    // at all, so append it rather than let it go unrepresented.
    if (selectedCluster && !top.some((c) => c.id === selectedCluster.id)) {
      return [...top, selectedCluster];
    }
    return top;
  }, [allEvents, selectedCluster]);

  if (events.length === 0) {
    return (
      <p className="text-xs text-[#737373] font-mono">Loading detections…</p>
    );
  }

  return (
    <div className="space-y-0.5">
      {events.map((event, index) => (
        <EventRow
          key={event.id}
          event={event}
          selected={selectedCluster?.id === event.id}
          outsideTopList={index >= MAX_LISTED_EVENTS}
          onSelect={() => setSelectedFire(event.seed)}
        />
      ))}
    </div>
  );
}

function EventRow({
  event,
  selected,
  outsideTopList,
  onSelect,
}: {
  event: FireCluster;
  selected: boolean;
  outsideTopList: boolean;
  onSelect: () => void;
}) {
  const color = cssColorForFrp(event.maxFrp);
  // Same generator the globe and the briefing use, and it is cached by fire id,
  // so this costs nothing beyond a map lookup after the first render.
  const impact = getDemoImpact(event.seed);

  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-2 py-1.5 border-l-2 transition-colors"
      style={{
        borderColor: selected ? color : "transparent",
        backgroundColor: selected ? "#1a1a1a" : "transparent",
        // Separate an appended selection from the ranked list above it.
        borderTop: outsideTopList ? "1px solid #262626" : undefined,
        marginTop: outsideTopList ? "0.5rem" : undefined,
      }}
    >
      {outsideTopList && (
        <div className="font-mono text-[8px] tracking-widest uppercase text-[#525252] mb-1">
          Selected · outside top {MAX_LISTED_EVENTS}
        </div>
      )}
      {/* The name gets the full row width — "British Columbia Complex 7" does
          not fit beside a value in a 256px column, and a truncated label is the
          one thing this list existed to fix. The multiplier moves down beside
          the FRP, which are both short. */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className="w-1.5 h-1.5 shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="font-mono text-[11px] text-[#e5e5e5] truncate">
          {event.label}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2 mt-0.5 pl-3">
        <span className="font-mono text-[9px] text-[#737373] truncate">
          {event.maxFrp.toFixed(0)} MW · {event.detectionCount}{" "}
          {event.detectionCount === 1 ? "detection" : "detections"}
        </span>
        <span
          className="font-mono text-[10px] tabular-nums shrink-0"
          style={{ color }}
        >
          {impact.worst.baselineMultiplier.toFixed(1)}x
        </span>
      </div>
    </button>
  );
}
