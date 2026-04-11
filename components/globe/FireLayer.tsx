"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  Viewer,
  Cartesian2,
  Cartesian3,
  Color,
  Math as CesiumMath,
  NearFarScalar,
  PointPrimitiveCollection,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
} from "cesium";
import { useFireData } from "@/hooks/useFireData";
import { useGeocore } from "@/store/useGeocore";
import type { FireEvent } from "@/types";

// Debounce window for camera-driven fire refetches.
const MOVE_END_DEBOUNCE_MS = 400;
// When the viewport spans more than this many degrees of longitude, fall back
// to the global fire set rather than sending an oversized / antimeridian-
// crossing bbox to FIRMS.
const MAX_VIEWPORT_LON_SPAN_DEG = 90;

interface FireLayerProps {
  viewer: Viewer;
}

// Fire point visual id — attached to each PointPrimitive so scene.pick can
// resolve it. We stash the full FireEvent inline so the click handler can
// populate the event card synchronously without looking up a fires array.
interface FirePickId {
  type: "fire";
  fire: FireEvent;
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
  const { fires, loadFires } = useFireData();
  const setSelectedFire = useGeocore((s) => s.setSelectedFire);
  const collectionRef = useRef<PointPrimitiveCollection | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const debounceRef = useRef<number | null>(null);

  // Compute the current camera viewport bbox and load fires for it.
  // Falls back to a global fetch when the viewport is too wide, crosses the
  // antimeridian, or the camera isn't framing the ellipsoid.
  const loadFiresForViewport = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const rect = viewer.camera.computeViewRectangle();
    if (!rect) {
      // Camera not yet framing the ellipsoid (e.g. called before the first
      // frame has rendered, or pointed at space). Fall back to global.
      loadFires();
      return;
    }

    const west = CesiumMath.toDegrees(rect.west);
    const south = CesiumMath.toDegrees(rect.south);
    const east = CesiumMath.toDegrees(rect.east);
    const north = CesiumMath.toDegrees(rect.north);

    // Handle antimeridian wraparound: Cesium reports east < west when the
    // viewport crosses the 180°/-180° seam.
    let lonSpan = east - west;
    if (lonSpan < 0) lonSpan += 360;

    if (lonSpan > MAX_VIEWPORT_LON_SPAN_DEG || east < west) {
      loadFires();
      return;
    }

    loadFires(`${west},${south},${east},${north}`);
  }, [viewer, loadFires]);

  // Attach camera.moveEnd listener (debounced) and fire an initial load.
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const onMoveEnd = () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        loadFiresForViewport();
      }, MOVE_END_DEBOUNCE_MS);
    };

    viewer.camera.moveEnd.addEventListener(onMoveEnd);

    // Initial load — camera.moveEnd does not fire on mount, and
    // computeViewRectangle() can return undefined if called before Cesium has
    // rendered its first frame. Delay the initial fetch so the camera is
    // fully positioned. loadFiresForViewport also handles the undefined case
    // with a global fallback as a belt-and-braces safety net.
    const initialLoadTimer = window.setTimeout(() => {
      loadFiresForViewport();
    }, 500);

    return () => {
      window.clearTimeout(initialLoadTimer);
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (!viewer.isDestroyed()) {
        viewer.camera.moveEnd.removeEventListener(onMoveEnd);
      }
    };
  }, [viewer, loadFiresForViewport]);

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
      const pickId: FirePickId = { type: "fire", fire };
      collection.add({
        position: Cartesian3.fromDegrees(fire.longitude, fire.latitude),
        color: colorForFrp(fire.frp),
        pixelSize: sizeForFrp(fire.frp),
        outlineColor: Color.fromCssColorString("#FFD6A0"),
        outlineWidth: 1,
        scaleByDistance,
        // Depth-test against terrain (set globally on the globe) so fires
        // on the far side of the earth are hidden behind it.
        disableDepthTestDistance: 0,
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

  // Click picking — scene.pick returns the PointPrimitive; its `id` is our
  // FirePickId, which carries the full FireEvent inline. No fetch, no
  // lookup, no async work.
  const handleClick = useCallback(
    (event: { position: Cartesian2 }) => {
      if (!viewer || viewer.isDestroyed()) return;

      const picked = viewer.scene.pick(event.position);
      if (!defined(picked)) return;

      const pickId = picked.id as FirePickId | undefined;
      if (pickId && pickId.type === "fire" && pickId.fire) {
        setSelectedFire(pickId.fire);
      }
    },
    [viewer, setSelectedFire]
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
