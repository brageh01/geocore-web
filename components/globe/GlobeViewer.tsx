"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Viewer } from "cesium";
import { initializeViewer } from "@/lib/cesium";
import { useGeocore } from "@/store/useGeocore";
import { DEMO_MODE } from "@/lib/demo/flag";
import FireLayer from "./FireLayer";
import DemoImpactLayer from "./DemoImpactLayer";

export default function GlobeViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const activeLayers = useGeocore((s) => s.activeLayers);
  const setViewer = useGeocore((s) => s.setViewer);

  const initViewer = useCallback(async () => {
    if (!containerRef.current || viewerRef.current) return;

    try {
      const viewer = await initializeViewer(containerRef.current);
      viewerRef.current = viewer;
      // Publish the viewer so consumers outside this subtree — the top bar's
      // camera presets, the impact overlay — can reach it without a prop.
      setViewer(viewer);
      setViewerReady(true);
    } catch (err) {
      console.error("Failed to initialize Cesium viewer:", err);
    }
  }, [setViewer]);

  useEffect(() => {
    initViewer();

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
        setViewer(null);
        setViewerReady(false);
      }
    };
  }, [initViewer, setViewer]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="w-full h-full" />
      {viewerReady && viewerRef.current && activeLayers.fires && (
        <FireLayer viewer={viewerRef.current} />
      )}
      {/* Reads the viewer from the store, so it needs no ref access here. */}
      {DEMO_MODE && activeLayers.aqi && <DemoImpactLayer />}
    </div>
  );
}
