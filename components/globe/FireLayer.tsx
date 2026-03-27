"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
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
import { useFireData } from "@/hooks/useFireData";
import { useGeocore } from "@/store/useGeocore";

interface FireLayerProps {
  viewer: Viewer;
}

export default function FireLayer({ viewer }: FireLayerProps) {
  const { fires } = useFireData();
  const setSelectedFireId = useGeocore((s) => s.setSelectedFireId);
  const entitiesRef = useRef<Entity[]>([]);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);

  // Create a fire pin canvas for billboard
  const fireIconDataUrl = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.arc(12, 12, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#FF4500";
      ctx.fill();
      ctx.strokeStyle = "#FF6A33";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    return canvas.toDataURL();
  }, []);

  // Render fire entities
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Clear previous entities
    for (const entity of entitiesRef.current) {
      viewer.entities.remove(entity);
    }
    entitiesRef.current = [];

    // Add new fire markers
    for (const fire of fires) {
      const entity = viewer.entities.add({
        id: `fire-${fire.id}`,
        position: Cartesian3.fromDegrees(fire.longitude, fire.latitude),
        billboard: {
          image: fireIconDataUrl,
          verticalOrigin: VerticalOrigin.CENTER,
          scaleByDistance: new NearFarScalar(1_000_000, 1.0, 10_000_000, 0.4),
          color: Color.fromCssColorString("#FF4500"),
          width: 16,
          height: 16,
        },
        properties: {
          fireId: fire.id,
          type: "fire",
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
  }, [viewer, fires, fireIconDataUrl]);

  // Handle click events
  const handleClick = useCallback(
    (event: { position: Cartesian2 }) => {
      if (!viewer || viewer.isDestroyed()) return;

      const picked = viewer.scene.pick(event.position);
      if (defined(picked) && picked.id && picked.id.id?.startsWith("fire-")) {
        const fireId = picked.id.properties?.fireId?.getValue();
        if (fireId) {
          setSelectedFireId(fireId);
        }
      }
    },
    [viewer, setSelectedFireId]
  );

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(handleClick, ScreenSpaceEventType.LEFT_CLICK);
    handlerRef.current = handler;

    return () => {
      if (!handler.isDestroyed()) {
        handler.destroy();
      }
      handlerRef.current = null;
    };
  }, [viewer, handleClick]);

  return null;
}
