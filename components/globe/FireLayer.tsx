"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
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
import type { FireEvent } from "@/lib/contracts";
import { DEMO_MODE } from "@/lib/demo/flag";

// Debounce window for camera-driven fire refetches. A trackpad pinch emits a
// long burst of camera events; at 400ms an unhurried zoom still slipped
// several fetches through, so this is the settle time before we consider the
// camera to have stopped.
const MOVE_END_DEBOUNCE_MS = 800;
// When the viewport spans more than this many degrees of longitude, fall back
// to the global fire set rather than sending an oversized / antimeridian-
// crossing bbox to FIRMS.
const MAX_VIEWPORT_LON_SPAN_DEG = 90;

// Viewport edges are snapped outward onto a grid of this size before becoming
// a request. Without it every pixel of camera movement yields a unique bbox
// and therefore a fresh FIRMS call — and FIRMS allows 10 requests/minute.
// Snapping means a whole neighbourhood of similar viewports collapses onto one
// cache key. Smaller values track the viewport more tightly but fragment the
// cache and fetch more; larger values over-fetch area you cannot see.
const BBOX_QUANTIZE_DEG = 5;

// Detections below this fire radiative power (MW) are not drawn. VIIRS flags a
// large tail of very low-power thermal anomalies — gas flares, industrial
// heat, small agricultural burns — that cost a point each and add little to a
// global situational view. Lower this toward 0 to see everything the satellite
// saw, at the cost of frame time.
const MIN_RENDER_FRP_MW = 1;

// Hard ceiling on points pushed to the GPU. A global 2-day VIIRS pull is
// routinely 50k–200k detections, and rebuilding a collection that size on
// every camera settle is what freezes the UI. When a viewport holds more than
// this we keep the highest-FRP detections, on the grounds that the largest
// fires are the ones worth seeing first. Raising it surfaces more of the long
// tail and costs frame time on every rebuild.
const MAX_RENDERED_POINTS = 3000;

/**
 * Snap a bbox outward onto the BBOX_QUANTIZE_DEG grid and format it for FIRMS.
 * Outward (floor the min edges, ceil the max edges) so the quantized box always
 * contains the real viewport — never less data than the user can see.
 */
function quantizeBbox(
  west: number,
  south: number,
  east: number,
  north: number
): string {
  const q = BBOX_QUANTIZE_DEG;
  let w = Math.max(-180, Math.floor(west / q) * q);
  let s = Math.max(-90, Math.floor(south / q) * q);
  let e = Math.min(180, Math.ceil(east / q) * q);
  let n = Math.min(90, Math.ceil(north / q) * q);

  // A viewport sitting exactly on a grid line can collapse to zero width or
  // height, which FIRMS rejects. Widen by one cell, staying inside bounds.
  if (e <= w) {
    if (w + q <= 180) e = w + q;
    else w = e - q;
  }
  if (n <= s) {
    if (s + q <= 90) n = s + q;
    else s = n - q;
  }

  return `${w},${s},${e},${n}`;
}

// Last thinning result printed to the console, so the same dataset does not
// log twice. Module-scoped because React Strict Mode remounts the component.
let lastLoggedSignature: string | null = null;

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
  const { fires, error, loadFires } = useFireData();
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

    // Quantize before the bbox becomes a request. useFireData keys its cache
    // on this string, so a camera that settles inside the same grid cell it
    // was already in resolves from cache without touching the network.
    loadFires(quantizeBbox(west, south, east, north));
  }, [viewer, loadFires]);

  // Attach camera.moveEnd listener (debounced) and fire an initial load.
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    // Demo mode: the fixture is already in the store and nothing the camera
    // does should change it. Never attach the listener at all — a debounce
    // that resolves to a no-op still costs a timer and a viewport computation
    // on every settle, and the point of demo mode is that panning does zero
    // work beyond drawing.
    if (DEMO_MODE) return;

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

  // Thin the raw detection list down to what we are willing to draw. Memoised
  // on `fires`, and useFireData hands back the same array reference on a cache
  // hit, so an unchanged dataset produces an unchanged `renderedFires` and the
  // rebuild effect below does not re-run.
  const renderedFires = useMemo(() => {
    const eligible = fires.filter((f) => f.frp >= MIN_RENDER_FRP_MW);

    const capped =
      eligible.length > MAX_RENDERED_POINTS
        ? [...eligible]
            .sort((a, b) => b.frp - a.frp)
            .slice(0, MAX_RENDERED_POINTS)
        : eligible;

    // Log once per distinct dataset, not once per memo evaluation — React
    // Strict Mode double-invokes the memo in dev and would otherwise print
    // every count twice. The empty initial store isn't a dataset, so skip it.
    const signature = `${fires.length}|${capped.length}`;
    if (fires.length > 0 && signature !== lastLoggedSignature) {
      lastLoggedSignature = signature;
      console.log(
        `[FireLayer] ${fires.length} detections → ${eligible.length} at or above ${MIN_RENDER_FRP_MW} MW FRP → ${capped.length} rendered (cap ${MAX_RENDERED_POINTS}, dropped ${fires.length - capped.length})`
      );
    }

    return capped;
  }, [fires]);

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

    if (renderedFires.length === 0) return;

    const collection = new PointPrimitiveCollection();
    viewer.scene.primitives.add(collection);
    collectionRef.current = collection;

    const scaleByDistance = new NearFarScalar(1_000_000, 1.0, 20_000_000, 0.3);

    for (const fire of renderedFires) {
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
  }, [viewer, renderedFires]);

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

  // Fire fetch failures used to be computed and thrown away — a FIRMS 429
  // meant points silently stopped updating with nothing on screen to say so.
  if (!error) return null;

  const isRateLimited = error.includes("429");

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none border border-[#FF4500]/60 bg-[#0a0a0a]/90 px-3 py-2">
      <div className="font-mono text-[10px] font-bold tracking-widest text-[#FF4500] uppercase">
        Fire Feed Error
      </div>
      <div className="font-mono text-[10px] text-[#e5e5e5] mt-1">
        {isRateLimited
          ? "FIRMS rate limit reached (10 req/min). Showing last loaded data."
          : error}
      </div>
    </div>
  );
}
