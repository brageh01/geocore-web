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
  PolylineDashMaterialProperty,
  PolylineGlowMaterialProperty,
  VerticalOrigin,
} from "cesium";
import { useGeocore } from "@/store/useGeocore";
import {
  compassPoint,
  getDemoImpact,
  type DemoAQIStation,
} from "@/lib/demo/fakeAQI";
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

// Wind spine: long enough to read as a direction, short enough not to compete
// with the smoke arcs it runs alongside.
const WIND_ARROW_LENGTH_KM = 45;
const WIND_ARROW_DELAY_MS = 250;

const LINK_COLOR = "#FF8A3D";
const LINK_WIDTH_PX = 6;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const EARTH_RADIUS_KM = 6371;

/** Great-circle destination — shared with the plume generator's geometry. */
function destinationFrom(
  latitude: number,
  longitude: number,
  bearingDeg: number,
  distanceKm: number
): { latitude: number; longitude: number } {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const angular = distanceKm / EARTH_RADIUS_KM;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(latitude);
  const lon1 = toRad(longitude);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    );
  return {
    latitude: toDeg(lat2),
    longitude: ((toDeg(lon2) + 540) % 360) - 180,
  };
}

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

    // --- wind direction ---
    // The panel says "downwind" but nothing in the scene said which way. A
    // short dashed spine along the plume axis, labelled with the compass
    // point, anchors that word to the geometry.
    const windEnd = destinationFrom(
      selectedFire.latitude,
      selectedFire.longitude,
      impact.downwindBearingDeg,
      WIND_ARROW_LENGTH_KM
    );
    // The label hangs off the middle of the spine rather than its tip. At the
    // tip it sat on top of the nearest station's label — both are downwind of
    // the same fire, so they compete for the same patch of screen.
    const windLabelAt = destinationFrom(
      selectedFire.latitude,
      selectedFire.longitude,
      impact.downwindBearingDeg,
      WIND_ARROW_LENGTH_KM * 0.45
    );
    const windAlpha = () =>
      clamp01((performance.now() - t0 - WIND_ARROW_DELAY_MS) / 400);

    created.push(
      viewer.entities.add({
        polyline: {
          positions: [
            Cartesian3.fromDegrees(
              selectedFire.longitude,
              selectedFire.latitude,
              FIRE_POINT_ALTITUDE_M
            ),
            Cartesian3.fromDegrees(
              windEnd.longitude,
              windEnd.latitude,
              FIRE_POINT_ALTITUDE_M
            ),
          ],
          width: 2,
          material: new PolylineDashMaterialProperty({
            color: new CallbackProperty(
              () => Color.WHITE.withAlpha(0.75 * windAlpha()),
              false
            ),
            dashLength: 12,
          }),
        },
        position: Cartesian3.fromDegrees(
          windLabelAt.longitude,
          windLabelAt.latitude,
          FIRE_POINT_ALTITUDE_M
        ),
        label: {
          text: `WIND → ${compassPoint(impact.downwindBearingDeg)}`,
          font: "600 10px ui-monospace, SFMono-Regular, monospace",
          style: LabelStyle.FILL,
          fillColor: new CallbackProperty(
            () => Color.WHITE.withAlpha(0.85 * windAlpha()),
            false
          ),
          showBackground: true,
          backgroundColor: new CallbackProperty(
            () => new Color(0.04, 0.04, 0.04, 0.7 * windAlpha()),
            false
          ),
          backgroundPadding: new Cartesian2(6, 4),
          horizontalOrigin: HorizontalOrigin.CENTER,
          verticalOrigin: VerticalOrigin.TOP,
          pixelOffset: new Cartesian2(0, 10),
          translucencyByDistance: new NearFarScalar(
            1_500_000,
            1.0,
            4_000_000,
            0.0
          ),
        },
      })
    );

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
            outlineWidth: 2,
            // A dark plate behind the text. An outline alone was not enough:
            // the labels sit over bright terrain and over the glowing arcs,
            // and white-on-pale was unreadable exactly where the plume is
            // densest — the part of the frame that matters most.
            showBackground: true,
            backgroundColor: new CallbackProperty(
              () => new Color(0.04, 0.04, 0.04, 0.72 * markerAlpha()),
              false
            ),
            backgroundPadding: new Cartesian2(7, 5),
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
