"use client";

import { useEffect, useRef } from "react";
import {
  BoundingSphere,
  Cartesian3,
  HeadingPitchRange,
  Math as CesiumMath,
} from "cesium";
import { useGeocore } from "@/store/useGeocore";
import { getDemoImpact } from "@/lib/demo/fakeAQI";
import { FIRE_POINT_ALTITUDE_M } from "./FireLayer";
import {
  ROTATION_RAD_PER_SECOND,
  SELECTION_FLIGHT_SECONDS,
  SELECTION_HEADING_DEG,
  SELECTION_PITCH_DEG,
  SELECTION_RANGE_PADDING,
  beginScriptedFlight,
  endScriptedFlight,
  stopAttractMode,
  shouldAttractRotate,
} from "@/lib/demo/cameraPresets";

/**
 * Idle globe rotation, and the flight that frames a fire with its impact links.
 * Demo mode only; renders nothing.
 */
export default function DemoCameraChoreography() {
  const viewer = useGeocore((s) => s.viewer);
  const selectedFire = useGeocore((s) => s.selectedFire);

  // --- idle rotation ---
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Discrete events that mean the user has taken the wheel.
    const interactionEvents = [
      "pointerdown",
      "pointerup",
      "wheel",
      "touchstart",
      "touchmove",
      "keydown",
    ] as const;

    // A drag emits one pointerdown and then only pointermove until release, so
    // movement with a button held counts as interaction too. Movement with no
    // button does not: resting the cursor over the globe while watching the
    // attract loop should not end it.
    const markIfDragging = (event: Event) => {
      if ((event as PointerEvent).buttons) stopAttractMode();
    };

    // Listen on window in the CAPTURE phase, not on the canvas.
    //
    // Cesium's own ScreenSpaceEventHandler binds to the canvas first and stops
    // pointerdown from reaching listeners registered after it — measured:
    // a canvas-level pointerdown listener added here never fires, while wheel
    // does. Bound that way, dragging the globe would not have ended attract
    // mode and the two would fight each other. Capturing on window runs before
    // anything on the canvas, so nothing downstream can swallow it.
    //
    // The wider scope is also the behaviour we want: clicking the sidebar or
    // the top bar is the user engaging with the app, and the globe should stop
    // turning under them for that too.
    const options = { capture: true, passive: true } as const;
    for (const name of interactionEvents) {
      window.addEventListener(name, stopAttractMode, options);
    }
    window.addEventListener("pointermove", markIfDragging, options);

    // Drive rotation off elapsed wall time rather than a per-frame constant, so
    // the rate is the same whether the scene is running at 120fps or struggling
    // at 20.
    let lastTick: number | null = null;

    const onPreRender = () => {
      if (!shouldAttractRotate()) {
        lastTick = null;
        return;
      }
      const now = performance.now();
      if (lastTick === null) {
        lastTick = now;
        return;
      }
      const deltaSeconds = (now - lastTick) / 1000;
      lastTick = now;

      // Rotate about the earth's spin axis, which orbits the camera in
      // longitude and preserves whatever oblique framing it already had.
      viewer.camera.rotate(
        Cartesian3.UNIT_Z,
        -ROTATION_RAD_PER_SECOND * deltaSeconds
      );
    };

    // No priming call here: attract mode is active from load, so the globe is
    // already turning by the time the first frame renders.
    viewer.scene.preRender.addEventListener(onPreRender);

    return () => {
      for (const name of interactionEvents) {
        window.removeEventListener(name, stopAttractMode, options);
      }
      window.removeEventListener("pointermove", markIfDragging, options);
      if (!viewer.isDestroyed()) {
        viewer.scene.preRender.removeEventListener(onPreRender);
      }
    };
  }, [viewer]);

  // --- frame the selected fire together with its impact links ---
  // Tracked by id: re-selecting the same fire object should not re-fly.
  const lastFlownFireId = useRef<string | null>(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    if (!selectedFire) {
      lastFlownFireId.current = null;
      return;
    }
    if (lastFlownFireId.current === selectedFire.id) return;
    lastFlownFireId.current = selectedFire.id;

    const impact = getDemoImpact(selectedFire);

    // A sphere enclosing the fire and every station it feeds, so the flight
    // frames the whole relationship instead of zooming past the links.
    const points = [
      Cartesian3.fromDegrees(
        selectedFire.longitude,
        selectedFire.latitude,
        FIRE_POINT_ALTITUDE_M
      ),
      ...impact.stations.map((station) =>
        Cartesian3.fromDegrees(
          station.longitude,
          station.latitude,
          FIRE_POINT_ALTITUDE_M
        )
      ),
    ];
    const sphere = BoundingSphere.fromPoints(points);

    beginScriptedFlight();
    viewer.camera.flyToBoundingSphere(sphere, {
      duration: SELECTION_FLIGHT_SECONDS,
      offset: new HeadingPitchRange(
        CesiumMath.toRadians(SELECTION_HEADING_DEG),
        CesiumMath.toRadians(SELECTION_PITCH_DEG),
        sphere.radius * SELECTION_RANGE_PADDING
      ),
      complete: endScriptedFlight,
      cancel: endScriptedFlight,
    });
  }, [viewer, selectedFire]);

  return null;
}
