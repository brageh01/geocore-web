"use client";

import dynamic from "next/dynamic";
import { useGeocore } from "@/store/useGeocore";
import EventCard from "@/components/panels/EventCard";
import ActiveEventsList from "@/components/panels/ActiveEventsList";
import CameraPresetButtons from "@/components/layout/CameraPresetButtons";
import { DEMO_MODE } from "@/lib/demo/flag";

const GlobeViewer = dynamic(() => import("@/components/globe/GlobeViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
      <span className="font-mono text-sm text-[#737373]">
        Initializing globe...
      </span>
    </div>
  ),
});

export default function DashboardShell() {
  const selectedFire = useGeocore((s) => s.selectedFire);
  const activeLayers = useGeocore((s) => s.activeLayers);
  const toggleLayer = useGeocore((s) => s.toggleLayer);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0a0a]">
      {/* Top bar */}
      <header className="h-10 flex items-center justify-between px-4 border-b border-[#262626] bg-[#0a0a0a] shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold tracking-widest text-[#e5e5e5] uppercase">
            Geocore
          </span>
          <span className="text-[#737373] text-xs font-mono">
            Global Disaster Intelligence
          </span>
          {/* Persistent provenance notice. The AQI numbers on screen are
              fabricated, and nothing in a recording should be able to be
              mistaken for a measurement. */}
          {DEMO_MODE && (
            <span
              className="font-mono text-[9px] tracking-widest uppercase px-1.5 py-0.5 border"
              style={{ color: "#A16207", borderColor: "#A1620755" }}
              title="AQI stations and impact links in this view are generated, not measured."
            >
              Simulated AQI Data
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {DEMO_MODE && (
            <>
              <CameraPresetButtons />
              <span className="w-px h-4 bg-[#262626]" />
            </>
          )}
          <div className="flex items-center gap-2">
            <LayerButton
              label="FIRES"
              active={activeLayers.fires}
              color="#FF4500"
              onClick={() => toggleLayer("fires")}
            />
            <LayerButton
              label="AQI"
              active={activeLayers.aqi}
              color="#00E400"
              onClick={() => toggleLayer("aqi")}
            />
          </div>
        </div>
      </header>

      {/* Main content: 3-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar — event list (placeholder) */}
        <aside className="w-64 border-r border-[#262626] bg-[#0a0a0a] overflow-y-auto shrink-0">
          <div className="p-3">
            <h2 className="font-mono text-[10px] font-bold tracking-widest text-[#737373] uppercase mb-3">
              Active Events
            </h2>
            {DEMO_MODE ? (
              <ActiveEventsList />
            ) : (
              <p className="text-xs text-[#737373] font-mono">
                Select a fire marker on the globe to view details.
              </p>
            )}
          </div>
        </aside>

        {/* Center — Globe */}
        <main className="flex-1 relative min-w-0">
          <GlobeViewer />
        </main>

        {/* Right sidebar — event details */}
        <aside className="w-80 border-l border-[#262626] bg-[#0a0a0a] overflow-y-auto shrink-0">
          {selectedFire ? (
            <EventCard />
          ) : (
            <div className="p-3">
              <h2 className="font-mono text-[10px] font-bold tracking-widest text-[#737373] uppercase mb-3">
                Event Data
              </h2>
              <p className="text-xs text-[#737373] font-mono">
                No event selected.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function LayerButton({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 font-mono text-[10px] tracking-wider uppercase transition-colors"
      style={{
        color: active ? color : "#737373",
        borderBottom: active ? `2px solid ${color}` : "2px solid transparent",
      }}
    >
      <span
        className="w-1.5 h-1.5"
        style={{
          backgroundColor: active ? color : "#404040",
        }}
      />
      {label}
    </button>
  );
}
