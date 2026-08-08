"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import {
  Viewer,
  Cartesian2,
  Cartesian3,
  Color,
  VerticalOrigin,
  NearFarScalar,
  Entity,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
} from "cesium";
import { useAQIData } from "@/hooks/useAQIData";
import type { AQIStation } from "@/lib/contracts";
import { aqiToColor } from "@/lib/aqiScale";

const MAX_AQI_ENTITIES = 300;

interface AQILayerProps {
  viewer: Viewer;
}

function getCameraHeight(viewer: Viewer): number {
  return viewer.camera.positionCartographic?.height ?? 8_000_000;
}

/**
 * Spatial grid clustering for AQI stations at high zoom levels.
 * Groups stations into cells and picks the station with the worst AQI.
 */
interface ClusteredStation {
  representative: AQIStation;
  count: number;
  maxAqi: number;
}

function clusterStations(
  stations: AQIStation[],
  cellSizeDeg: number,
): ClusteredStation[] {
  const cells = new Map<string, ClusteredStation>();

  for (const station of stations) {
    const cellX = Math.floor(station.longitude / cellSizeDeg);
    const cellY = Math.floor(station.latitude / cellSizeDeg);
    const key = `${cellX}_${cellY}`;

    const existing = cells.get(key);
    if (existing) {
      existing.count += 1;
      if (station.aqi > existing.maxAqi) {
        existing.maxAqi = station.aqi;
        existing.representative = station;
      }
    } else {
      cells.set(key, {
        representative: station,
        count: 1,
        maxAqi: station.aqi,
      });
    }
  }

  return Array.from(cells.values());
}

function getCellSize(cameraHeightMeters: number): number {
  if (cameraHeightMeters > 8_000_000) return 5;
  if (cameraHeightMeters > 4_000_000) return 2;
  if (cameraHeightMeters > 1_000_000) return 1;
  if (cameraHeightMeters > 500_000) return 0.5;
  if (cameraHeightMeters > 100_000) return 0.1;
  return 0;
}

export default function AQILayer({ viewer }: AQILayerProps) {
  const { stations } = useAQIData();
  const entitiesRef = useRef<Entity[]>([]);
  const [cameraHeight, setCameraHeight] = useState(() =>
    getCameraHeight(viewer),
  );

  // Track camera height
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const onMoveEnd = () => setCameraHeight(getCameraHeight(viewer));
    viewer.camera.moveEnd.addEventListener(onMoveEnd);

    return () => {
      if (!viewer.isDestroyed()) {
        viewer.camera.moveEnd.removeEventListener(onMoveEnd);
      }
    };
  }, [viewer]);

  // Create AQI icon canvas: a diamond shape
  const aqiIconDataUrl = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 20;
    canvas.height = 20;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(10, 2);
      ctx.lineTo(18, 10);
      ctx.lineTo(10, 18);
      ctx.lineTo(2, 10);
      ctx.closePath();
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
    }
    return canvas.toDataURL();
  }, []);

  // Compute visible stations: cluster + cap
  const visibleStations = useMemo(() => {
    const cellSize = getCellSize(cameraHeight);
    let result: ClusteredStation[];

    if (cellSize > 0) {
      result = clusterStations(stations, cellSize);
    } else {
      result = stations.map((s) => ({
        representative: s,
        count: 1,
        maxAqi: s.aqi,
      }));
    }

    // Sort by worst AQI first, cap at MAX_AQI_ENTITIES
    result.sort((a, b) => b.maxAqi - a.maxAqi);
    return result.slice(0, MAX_AQI_ENTITIES);
  }, [stations, cameraHeight]);

  // Render AQI entities
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Clear previous
    for (const entity of entitiesRef.current) {
      viewer.entities.remove(entity);
    }
    entitiesRef.current = [];

    for (const cluster of visibleStations) {
      const station = cluster.representative;
      const color = aqiToColor(station.aqi);

      const entity = viewer.entities.add({
        id: `aqi-${station.id}`,
        position: Cartesian3.fromDegrees(station.longitude, station.latitude),
        billboard: {
          image: aqiIconDataUrl,
          verticalOrigin: VerticalOrigin.CENTER,
          scaleByDistance: new NearFarScalar(500_000, 1.0, 8_000_000, 0.5),
          color: Color.fromCssColorString(color),
          width: 14,
          height: 14,
        },
        label: {
          text: String(station.aqi),
          font: "9px monospace",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          verticalOrigin: VerticalOrigin.TOP,
          pixelOffset: new Cartesian2(0, 10),
          scaleByDistance: new NearFarScalar(500_000, 1.0, 8_000_000, 0.4),
          style: 2, // FILL_AND_OUTLINE
        },
        properties: {
          stationId: station.id,
          type: "aqi",
        } as any,
      });
      entitiesRef.current.push(entity);
    }

    return () => {
      for (const entity of entitiesRef.current) {
        if (!viewer.isDestroyed()) {
          viewer.entities.remove(entity);
        }
      }
      entitiesRef.current = [];
    };
  }, [viewer, visibleStations, aqiIconDataUrl]);

  return null;
}
