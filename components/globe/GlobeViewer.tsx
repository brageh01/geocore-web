"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Viewer } from "cesium";
import { initializeViewer } from "@/lib/cesium";
import { useGeocore } from "@/store/useGeocore";
import FireLayer from "./FireLayer";

export default function GlobeViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const activeLayers = useGeocore((s) => s.activeLayers);

  const initViewer = useCallback(async () => {
    if (!containerRef.current || viewerRef.current) return;

    try {
      const viewer = await initializeViewer(containerRef.current);
      viewerRef.current = viewer;
      setViewerReady(true);
    } catch (err) {
      console.error("Failed to initialize Cesium viewer:", err);
    }
  }, []);

  useEffect(() => {
    initViewer();

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
        setViewerReady(false);
      }
    };
  }, [initViewer]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="w-full h-full" />
      {viewerReady && viewerRef.current && activeLayers.fires && (
        <FireLayer viewer={viewerRef.current} />
      )}
    </div>
  );
}
