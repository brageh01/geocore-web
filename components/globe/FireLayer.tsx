"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  Viewer,
  Cartesian2,
  Cartesian3,
  Color,
  NearFarScalar,
  PointPrimitiveCollection,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
} from "cesium";
import { useFireData } from "@/hooks/useFireData";
import { useGeocore } from "@/store/useGeocore";

interface FireLayerProps {
  viewer: Viewer;
}

// Fire point visual id — attached to each PointPrimitive so scene.pick can resolve it.
interface FirePickId {
  type: "fire";
  fireId: string;
}

function colorForFrp(frp: number): Color {
  // EPA-ish orange→red gradient based on fire radiative power (MW)
  if (frp >= 100) return Color.fromCssColorString("#FF1A00");
  if (frp >= 50) return Color.fromCssColorString("#FF3D00");
  if (frp >= 20) return Color.fromCssColorString("#FF6A00");
  if (frp >= 5) return Color.fromCssColorString("#FF8C1A");
  return Color.fromCssColorString("#FFB347");
}

function sizeForFrp(frp: number): number {
  // 6px baseline, up to ~14px for very intense fires
  if (frp >= 100) return 14;
  if (frp >= 50) return 12;
  if (frp >= 20) return 10;
  if (frp >= 5) return 8;
  return 6;
}

export default function FireLayer({ viewer }: FireLayerProps) {
  const { fires } = useFireData();
  const setSelectedFireId = useGeocore((s) => s.setSelectedFireId);
  const collectionRef = useRef<PointPrimitiveCollection | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);

  // Render fire points into a single GPU-batched PointPrimitiveCollection.
  // This is dramatically faster than adding one Entity per fire when there
  // are tens of thousands of points.
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Tear down previous collection
    if (collectionRef.current) {
      viewer.scene.primitives.remove(collectionRef.current);
      collectionRef.current = null;
    }

    if (fires.length === 0) return;

    const collection = new PointPrimitiveCollection();
    viewer.scene.primitives.add(collection);
    collectionRef.current = collection;

    const scaleByDistance = new NearFarScalar(1_000_000, 1.0, 20_000_000, 0.3);

    for (const fire of fires) {
      const pickId: FirePickId = { type: "fire", fireId: fire.id };
      collection.add({
        position: Cartesian3.fromDegrees(fire.longitude, fire.latitude),
        color: colorForFrp(fire.frp),
        pixelSize: sizeForFrp(fire.frp),
        outlineColor: Color.fromCssColorString("#FFD6A0"),
        outlineWidth: 1,
        scaleByDistance,
        // Render points on top of 3D Tiles terrain — without this they
        // get occluded by Google Photorealistic 3D Tiles and disappear.
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        id: pickId,
      });
    }

    return () => {
      if (!viewer.isDestroyed() && collectionRef.current) {
        viewer.scene.primitives.remove(collectionRef.current);
      }
      collectionRef.current = null;
    };
  }, [viewer, fires]);

  // Click picking — scene.pick returns the PointPrimitive; its `id` is our FirePickId.
  const handleClick = useCallback(
    (event: { position: Cartesian2 }) => {
      if (!viewer || viewer.isDestroyed()) return;

      const picked = viewer.scene.pick(event.position);
      if (!defined(picked)) return;

      const pickId = picked.id as FirePickId | undefined;
      if (pickId && pickId.type === "fire" && pickId.fireId) {
        setSelectedFireId(pickId.fireId);
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
