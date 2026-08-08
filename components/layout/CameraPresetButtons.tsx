"use client";

import { useCallback } from "react";
import { useGeocore } from "@/store/useGeocore";
import {
  CAMERA_PRESETS,
  PRESET_FLIGHT_SECONDS,
  beginScriptedFlight,
  endScriptedFlight,
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
    </div>
  );
}
