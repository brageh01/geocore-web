"use client";

import { useEffect, useRef, useState } from "react";
import type { Viewer } from "cesium";
import { createViewer, loadPhotorealisticTiles } from "@/lib/cesium";
import { useGeocore } from "@/store/useGeocore";
import { DEMO_MODE } from "@/lib/demo/flag";
import FireLayer from "./FireLayer";
import DemoImpactLayer from "./DemoImpactLayer";
import DemoCameraChoreography from "./DemoCameraChoreography";
import GlobeLegend from "./GlobeLegend";

export default function GlobeViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  // The viewer is state, not a ref, for two reasons: reading a ref during
  // render is what the react-hooks/refs lint errors were about, and a ref
  // mutation does not re-render, so child layers could not be handed the
  // viewer reliably. State makes "the viewer exists" a render-visible fact.
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const activeLayers = useGeocore((s) => s.activeLayers);
  const publishViewer = useGeocore((s) => s.setViewer);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Synchronous construction is what makes this effect correct under Strict
    // Mode. The previous version awaited an async initialiser, so the cleanup
    // could fire while the viewer was still being built and had nothing to
    // destroy; the guard `if (viewerRef.current) return` then let the second
    // mount build a *second* viewer on the same container. Both stayed alive,
    // and whichever won the race got the visible canvas while the layers were
    // bound to the other — fires rendering into an orphan, camera flights
    // moving a camera nobody could see.
    //
    // Now: mount creates one viewer, cleanup destroys that exact viewer, and
    // the second mount starts clean. Dev and production behave identically.
    let created: Viewer;
    try {
      created = createViewer(container);
    } catch (err) {
      console.error("Failed to initialize Cesium viewer:", err);
      return;
    }

    setViewer(created);
    publishViewer(created);

    // Fire and forget: the tileset either becomes the surface or the Cesium
    // globe stays. It guards against the viewer being destroyed mid-request.
    void loadPhotorealisticTiles(created);

    return () => {
      setViewer(null);
      publishViewer(null);
      if (!created.isDestroyed()) created.destroy();
    };
  }, [publishViewer]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="w-full h-full" />
      {viewer && activeLayers.fires && <FireLayer viewer={viewer} />}
      {viewer && DEMO_MODE && activeLayers.aqi && <DemoImpactLayer />}
      {viewer && DEMO_MODE && <DemoCameraChoreography />}
      {DEMO_MODE && <GlobeLegend />}
    </div>
  );
}
