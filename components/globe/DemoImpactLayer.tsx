"use client";

import { useEffect } from "react";
import {
  Cartesian2,
  Cartesian3,
  CallbackProperty,
  Color,
  Entity,
  HorizontalOrigin,
  LabelStyle,
  NearFarScalar,
  PolylineGlowMaterialProperty,
  VerticalOrigin,
} from "cesium";
import { useGeocore } from "@/store/useGeocore";
import { getDemoImpact, type DemoAQIStation } from "@/lib/demo/fakeAQI";
import { aqiToColor } from "@/lib/aqiScale";
import { FIRE_POINT_ALTITUDE_M } from "./FireLayer";
import type { FireEvent } from "@/lib/contracts";

/**
 * The cause-and-effect overlay — demo mode only.
 *
 * On fire selection this draws a glowing arc from the fire out to each
 * simulated downwind AQI station. The links grow outward rather than appearing
 * all at once, staggered slightly, so the sequence reads as the link being
 * discovered. The data behind it is fabricated; see lib/demo/fakeAQI.ts.
 */

// How long one link takes to draw itself, and the offset between consecutive
// links. 5 links at 90ms stagger finish in 500 + 360 = ~860ms, which is brisk
// enough to feel responsive to a click but slow enough to read on video.
const LINK_DRAW_MS = 500;
const LINK_STAGGER_MS = 90;
// Marker and label fade in as their link lands, slightly before it completes.
const MARKER_FADE_START_FRACTION = 0.6;
const MARKER_FADE_MS = 260;

// Arc geometry. A straight chord between two points 3 km up reads as flat and
// gets lost against terrain; lifting the midpoint makes the direction of the
// relationship obvious from an oblique camera.
const ARC_SAMPLES = 48;
const ARC_APEX_PER_KM_M = 180;
const ARC_APEX_MAX_M = 26_000;

const LINK_COLOR = "#FF8A3D";
const LINK_WIDTH_PX = 6;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Sample a great-circle-ish arc from the fire to a station, bowed upward.
 * Linear interpolation of lat/lon is accurate enough over the <=150 km these
 * plumes span.
 */
function buildArc(fire: FireEvent, station: DemoAQIStation): Cartesian3[] {
  const apex = Math.min(ARC_APEX_MAX_M, station.distanceKm * ARC_APEX_PER_KM_M);

  // Unwrap the longitude delta so a plume straddling the antimeridian is drawn
  // the short way round instead of all the way across the planet.
  let deltaLon = station.longitude - fire.longitude;
  if (deltaLon > 180) deltaLon -= 360;
  if (deltaLon < -180) deltaLon += 360;
  const deltaLat = station.latitude - fire.latitude;

  const points: Cartesian3[] = [];
  for (let i = 0; i <= ARC_SAMPLES; i++) {
    const s = i / ARC_SAMPLES;
    points.push(
      Cartesian3.fromDegrees(
        fire.longitude + deltaLon * s,
        fire.latitude + deltaLat * s,
        FIRE_POINT_ALTITUDE_M + apex * Math.sin(Math.PI * s)
      )
    );
  }
  return points;
}

export default function DemoImpactLayer() {
  const viewer = useGeocore((s) => s.viewer);
  const selectedFire = useGeocore((s) => s.selectedFire);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !selectedFire) return;

    const impact = getDemoImpact(selectedFire);
    const created: Entity[] = [];
    const t0 = performance.now();

    impact.stations.forEach((station, index) => {
      const arc = buildArc(selectedFire, station);
      const startAt = t0 + index * LINK_STAGGER_MS;

      // Shared clock for this link. Read per frame by the callbacks below.
      const linkProgress = () =>
        clamp01((performance.now() - startAt) / LINK_DRAW_MS);
      const markerAlpha = () =>
        clamp01(
          (performance.now() -
            (startAt + LINK_DRAW_MS * MARKER_FADE_START_FRACTION)) /
            MARKER_FADE_MS
        );

      const stationColor = Color.fromCssColorString(aqiToColor(station.aqi));

      // --- the link itself ---
      created.push(
        viewer.entities.add({
          polyline: {
            // Grow the arc outward from the fire. Fewer than two positions
            // draws nothing, which is what we want before the link starts.
            positions: new CallbackProperty(() => {
              const t = easeOutCubic(linkProgress());
              if (t <= 0) return [];
              return arc.slice(0, Math.max(2, Math.ceil(t * arc.length)));
            }, false),
            width: LINK_WIDTH_PX,
            material: new PolylineGlowMaterialProperty({
              glowPower: 0.22,
              // Taper toward the fire end so the arc reads as emanating from
              // the source rather than as a symmetric bridge.
              taperPower: 0.85,
              color: new CallbackProperty(
                () =>
                  Color.fromCssColorString(LINK_COLOR).withAlpha(
                    0.3 + 0.7 * linkProgress()
                  ),
                false
              ),
            }),
          },
        })
      );

      // --- the station marker ---
      created.push(
        viewer.entities.add({
          position: Cartesian3.fromDegrees(
            station.longitude,
            station.latitude,
            FIRE_POINT_ALTITUDE_M
          ),
          point: {
            pixelSize: 13,
            color: new CallbackProperty(
              () => stationColor.withAlpha(markerAlpha()),
              false
            ),
            outlineColor: new CallbackProperty(
              () => Color.WHITE.withAlpha(0.85 * markerAlpha()),
              false
            ),
            outlineWidth: 2,
            scaleByDistance: new NearFarScalar(200_000, 1.5, 8_000_000, 0.5),
          },
          label: {
            text: `${station.name}\n${station.pm25} µg/m³`,
            font: "600 12px ui-monospace, SFMono-Regular, monospace",
            style: LabelStyle.FILL_AND_OUTLINE,
            fillColor: new CallbackProperty(
              () => Color.WHITE.withAlpha(markerAlpha()),
              false
            ),
            outlineColor: new CallbackProperty(
              () => Color.BLACK.withAlpha(0.9 * markerAlpha()),
              false
            ),
            outlineWidth: 3,
            horizontalOrigin: HorizontalOrigin.CENTER,
            verticalOrigin: VerticalOrigin.BOTTOM,
            pixelOffset: new Cartesian2(0, -18),
            // Hide the text once the camera is far enough out that the labels
            // would overlap into an unreadable pile.
            translucencyByDistance: new NearFarScalar(
              1_500_000,
              1.0,
              4_000_000,
              0.0
            ),
          },
        })
      );
    });

    return () => {
      if (viewer.isDestroyed()) return;
      for (const entity of created) {
        viewer.entities.remove(entity);
      }
    };
  }, [viewer, selectedFire]);

  return null;
}
