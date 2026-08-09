"use client";

import { useCallback } from "react";
import { useGeocore } from "@/store/useGeocore";
import { DEFAULT_CAMERA, RESET_FLIGHT_SECONDS } from "@/lib/cameraDefaults";
import {
  CAMERA_PRESETS,
  PRESET_FLIGHT_SECONDS,
  beginScriptedFlight,
  endScriptedFlight,
  startAttractMode,
  type CameraPreset,
} from "@/lib/demo/cameraPresets";

/**
 * Top-bar shortcuts to the three fixture regions — demo mode only.
 *
 * Cesium is imported lazily inside the click handler rather than at module
 * scope: this component is rendered by DashboardShell, which is *not* behind
 * the `ssr: false` boundary that keeps Cesium out of the server render.
 */
export default function CameraPresetButtons() {
  const viewer = useGeocore((s) => s.viewer);
  const setSelectedFire = useGeocore((s) => s.setSelectedFire);

  /**
   * Back to the opening view: clears the selection (which tears down the impact
   * links), flies home, and restarts attract mode.
   *
   * Attract mode is restarted on touchdown rather than on click, for two
   * reasons: the click's own pointerdown ends attract mode via the global
   * listener and would race a restart here, and rotating the globe while the
   * flight is still running would have the two fighting over the camera.
   */
  const resetView = useCallback(async () => {
    if (!viewer || viewer.isDestroyed()) return;

    const { Cartesian3, Math: CesiumMath } = await import("cesium");
    if (viewer.isDestroyed()) return;

    setSelectedFire(null);

    beginScriptedFlight();
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        DEFAULT_CAMERA.longitude,
        DEFAULT_CAMERA.latitude,
        DEFAULT_CAMERA.height
      ),
      orientation: {
        heading: CesiumMath.toRadians(DEFAULT_CAMERA.headingDeg),
        pitch: CesiumMath.toRadians(DEFAULT_CAMERA.pitchDeg),
        roll: CesiumMath.toRadians(DEFAULT_CAMERA.rollDeg),
      },
      duration: RESET_FLIGHT_SECONDS,
      complete: () => {
        endScriptedFlight();
        startAttractMode();
      },
      cancel: endScriptedFlight,
    });
  }, [viewer, setSelectedFire]);

  const flyTo = useCallback(
    async (preset: CameraPreset) => {
      if (!viewer || viewer.isDestroyed()) return;

      const { BoundingSphere, Cartesian3, HeadingPitchRange, Math: CesiumMath } =
        await import("cesium");

      // Re-check: the viewer can be torn down while the import resolves.
      if (viewer.isDestroyed()) return;

      const sphere = new BoundingSphere(
        Cartesian3.fromDegrees(preset.longitude, preset.latitude, 0),
        preset.rangeM
      );

      beginScriptedFlight();
      viewer.camera.flyToBoundingSphere(sphere, {
        duration: PRESET_FLIGHT_SECONDS,
        offset: new HeadingPitchRange(
          CesiumMath.toRadians(preset.headingDeg),
          CesiumMath.toRadians(preset.pitchDeg),
          preset.rangeM
        ),
        complete: endScriptedFlight,
        cancel: endScriptedFlight,
      });
    },
    [viewer]
  );

  return (
    <div className="flex items-center gap-1">
      {CAMERA_PRESETS.map((preset) => (
        <button
          key={preset.id}
          onClick={() => flyTo(preset)}
          disabled={!viewer}
          className="px-2 py-1 font-mono text-[10px] tracking-wider uppercase text-[#737373] hover:text-[#e5e5e5] disabled:opacity-40 disabled:hover:text-[#737373] transition-colors border border-transparent hover:border-[#262626]"
        >
          {preset.label}
        </button>
      ))}
      <button
        onClick={resetView}
        disabled={!viewer}
        title="Return to the global view and resume rotation"
        className="ml-1 px-2 py-1 font-mono text-[10px] tracking-wider uppercase text-[#a3a3a3] hover:text-[#e5e5e5] disabled:opacity-40 disabled:hover:text-[#a3a3a3] transition-colors border border-[#262626] hover:border-[#404040]"
      >
        Reset View
      </button>
    </div>
  );
}
