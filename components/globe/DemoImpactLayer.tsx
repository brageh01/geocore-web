"use client";

import { useEffect } from "react";
import {
  Cartesian2,
  Cartesian3,
  CallbackProperty,
  Color,
  ColorMaterialProperty,
  Entity,
  HorizontalOrigin,
  LabelStyle,
  NearFarScalar,
  PolylineDashMaterialProperty,
  PolylineGlowMaterialProperty,
  Ray,
  SceneTransforms,
  VerticalOrigin,
} from "cesium";
import { useGeocore } from "@/store/useGeocore";
import {
  compassPoint,
  getDemoImpact,
  type DemoAQIStation,
} from "@/lib/demo/fakeAQI";
import { aqiToBadgeTextColor, aqiToColor } from "@/lib/aqiScale";
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

// --- station badges ---------------------------------------------------------
//
// Stations used to float their name and PM2.5 reading beside the marker. Two
// problems with that. The boxes are 100-180 px wide, and the generator puts a
// fire's nearest stations within a few tens of km of one another, so at any
// framing that shows the plume they land on the same patch of screen — no
// layout can make objects that big fit in that little space, only choose which
// of them to sacrifice. And the text was redundant: the IMPACT ASSESSMENT
// panel already lists every station with name, distance, reading and category,
// better formatted and with room to breathe.
//
// The globe now carries an index instead — a 20 px disc filled with the
// station's AQI colour, numbered by distance from the fire, matching the
// numbers and the order in that panel. It keeps everything a mark on a map is
// for (where, how bad, which one) and hands the prose to the panel. A disc an
// order of magnitude smaller than a text box also collides far more rarely,
// which is what turns the layout pass below from load-bearing into a fallback.
const BADGE_DIAMETER_PX = 20;
const BADGE_RING_WIDTH_PX = 1.5;
const BADGE_FONT = "700 11px ui-monospace, SFMono-Regular, monospace";
// The badge image is drawn at 3x and downsampled by the billboard, so the disc
// edge and the digit stay crisp on a HiDPI display without this having to read
// devicePixelRatio (which can change mid-session when a window moves screens).
const BADGE_SUPERSAMPLE = 3;
// Badges shrink with distance so a far-out plume does not turn into a row of
// full-size discs, but far less aggressively than the old markers did: the
// digit has to stay readable, which a 0.5x scale does not allow.
const BADGE_SCALE_BY_DISTANCE = new NearFarScalar(200_000, 1.0, 8_000_000, 0.7);
// Metres toward the camera, in eye space, so badges win the depth test against
// the arcs. The stations of one fire are strung along a single plume axis, so
// the arc to the farthest one passes directly over every station in front of
// it, bowed up by as much as the apex cap — from a top-down camera that is a
// 6 px glowing line straight through the digit. Clearing the cap settles every
// case. 6371 km of planet still occludes the far side, and 30 km of depth can
// only put a badge in front of terrain at a near-grazing framing, where a
// marker drawn over an intervening ridge is the conventional behaviour anyway.
const BADGE_EYE_OFFSET = new Cartesian3(0, 0, -(ARC_APEX_MAX_M + 4_000));

const WIND_LABEL_FONT = "600 10px ui-monospace, SFMono-Regular, monospace";
// Cesium renders label text at roughly 1.2x the font size per line, and the
// background plate adds its padding on each side. Both are needed to know how
// much screen the wind label occupies, since the badges lay out around it.
const WIND_LABEL_LINE_HEIGHT_PX = 13;
const WIND_LABEL_PADDING_X_PX = 6;
const WIND_LABEL_PADDING_Y_PX = 4;

// --- badge decluttering -----------------------------------------------------
//
// A badge sits *on* its station, so its resting offset is zero and an
// undisplaced badge is simply the marker. When two do overlap, the later one is
// pushed straight up until it clears. Vertical-only displacement keeps it
// horizontally centred over its own station, which is what makes a one-pixel
// leader enough to say which position it belongs to.
//
// Placement order is by proximity to the fire, so the nearest stations — the
// ones the panel leads with — keep their true position and everything else
// moves around them.
const BADGE_RESTING_OFFSET_PX = 0;
const BADGE_MIN_GAP_PX = 4;
// Below this much displacement the badge still reads as sitting on its station
// and a hairline under it would be noise for no information.
const LEADER_VISIBLE_BEYOND_PX = 6;
// A badge is a station's only mark on the globe, so unlike the old labels it is
// never hidden. If no clear spot exists within this much lift, it drops back to
// its true position and overlaps — a half-covered disc still shows two stations
// are there, whereas hiding one claims a station that exists does not.
const MAX_BADGE_PUSH_PX = 150;

/** Mutable per-badge layout, written each frame and read by the entity. */
interface BadgeLayout {
  anchor: Cartesian3;
  offset: Cartesian2;
  showLeader: boolean;
  leaderEnd: Cartesian3;
}

interface ScreenBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Width of the widest line, in CSS pixels. Used for the wind label, which is a
 * fixed obstacle the badges lay out around, so its footprint has to be known
 * before it is drawn. Measured rather than estimated from character count,
 * because a box built on a guessed average either overlaps or leaves gaps.
 */
let measureContext: CanvasRenderingContext2D | null = null;
function measureTextWidth(lines: string[], font: string): number {
  if (!measureContext) {
    measureContext = document.createElement("canvas").getContext("2d");
  }
  const context = measureContext;
  if (!context) {
    // No 2D context is a broken browser rather than a real case, but a rough
    // monospace estimate is better than a zero-width box that never collides.
    const longest = lines.reduce((n, line) => Math.max(n, line.length), 0);
    return longest * 7.2;
  }
  context.font = font;
  return lines.reduce(
    (widest, line) => Math.max(widest, context.measureText(line).width),
    0
  );
}

function boxesOverlap(a: ScreenBox, b: ScreenBox): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

/**
 * Cesium's own NearFarScalar interpolation, in JS.
 *
 * The layout pass has to reserve the space a badge will actually occupy, and
 * that is the scaled size, not the nominal one. Recomputing it here keeps the
 * collision boxes exact at every camera distance; reserving the unscaled 20 px
 * would push badges apart at far framings for overlaps that never happen.
 */
function nearFarValue(scalar: NearFarScalar, distance: number): number {
  const span = scalar.far - scalar.near;
  const t = span <= 0 ? 1 : (distance - scalar.near) / span;
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return scalar.nearValue + (scalar.farValue - scalar.nearValue) * clamped;
}

/**
 * The badge image: a filled disc, a thin white ring, and the index.
 *
 * Drawn to a canvas rather than assembled from a Cesium point plus a Cesium
 * label for two reasons. PointGraphics has no pixelOffset, so a point-based
 * badge could not be displaced at all; and a two-entity badge would need the
 * digit's baseline metrics to sit centred in the disc, which the canvas gives
 * exactly via textBaseline.
 */
function drawBadge(
  index: number,
  fill: string,
  textColor: string
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = BADGE_DIAMETER_PX * BADGE_SUPERSAMPLE;
  canvas.height = BADGE_DIAMETER_PX * BADGE_SUPERSAMPLE;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  context.scale(BADGE_SUPERSAMPLE, BADGE_SUPERSAMPLE);
  const radius = BADGE_DIAMETER_PX / 2;

  context.beginPath();
  context.arc(radius, radius, radius - BADGE_RING_WIDTH_PX, 0, Math.PI * 2);
  context.fillStyle = fill;
  context.fill();
  // The ring is what separates a badge from bright terrain and from the glowing
  // arc it sits on the end of — several band colours are close to both.
  context.lineWidth = BADGE_RING_WIDTH_PX;
  context.strokeStyle = "rgba(255,255,255,0.9)";
  context.stroke();

  context.fillStyle = textColor;
  context.font = BADGE_FONT;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(index), radius, radius);
  return canvas;
}

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

    const windLabelText = `WIND → ${compassPoint(impact.downwindBearingDeg)}`;
    // The wind label does not move — it is an obstacle the station labels are
    // laid out around, not a participant in the layout.
    const windLabel = {
      anchor: Cartesian3.fromDegrees(
        windLabelAt.longitude,
        windLabelAt.latitude,
        FIRE_POINT_ALTITUDE_M
      ),
      offsetY: 10,
      halfWidth:
        measureTextWidth([windLabelText], WIND_LABEL_FONT) / 2 +
        WIND_LABEL_PADDING_X_PX,
      height: WIND_LABEL_LINE_HEIGHT_PX + WIND_LABEL_PADDING_Y_PX * 2,
    };

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
          text: windLabelText,
          font: WIND_LABEL_FONT,
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

    // Layouts in the order the badges claim space: nearest station first.
    // `impact.stations` is already sorted nearest-first, which is also the
    // order the panel lists them in and therefore the numbering.
    const badgeLayouts: BadgeLayout[] = [];

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

      const stationPosition = Cartesian3.fromDegrees(
        station.longitude,
        station.latitude,
        FIRE_POINT_ALTITUDE_M
      );
      const layout: BadgeLayout = {
        anchor: stationPosition,
        offset: new Cartesian2(0, BADGE_RESTING_OFFSET_PX),
        showLeader: false,
        leaderEnd: new Cartesian3(),
      };
      badgeLayouts.push(layout);

      // --- leader line ---
      // Drawn only once a badge has been pushed off its station. Below that it
      // reads as attached on its own, and a hairline under every badge would be
      // visual noise for no information.
      created.push(
        viewer.entities.add({
          polyline: {
            positions: new CallbackProperty(
              () => (layout.showLeader ? [stationPosition, layout.leaderEnd] : []),
              false
            ),
            width: 1,
            material: new ColorMaterialProperty(
              new CallbackProperty(
                () => Color.WHITE.withAlpha(0.45 * markerAlpha()),
                false
              )
            ),
          },
        })
      );

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

      // --- the station badge ---
      created.push(
        viewer.entities.add({
          position: stationPosition,
          billboard: {
            image: drawBadge(
              index + 1,
              aqiToColor(station.aqi),
              aqiToBadgeTextColor(station.aqi)
            ),
            // Explicit size in CSS pixels: the image is 3x supersampled, and
            // without this the billboard would render at the image's own size.
            width: BADGE_DIAMETER_PX,
            height: BADGE_DIAMETER_PX,
            // Multiplies the image, so this is the fade-in — the badge's own
            // colours come from the canvas.
            color: new CallbackProperty(
              () => Color.WHITE.withAlpha(markerAlpha()),
              false
            ),
            horizontalOrigin: HorizontalOrigin.CENTER,
            verticalOrigin: VerticalOrigin.CENTER,
            // Rewritten every frame by the declutter pass below.
            pixelOffset: new CallbackProperty(() => layout.offset, false),
            scaleByDistance: BADGE_SCALE_BY_DISTANCE,
            // Keeps the smoke arcs behind the badge instead of cutting through
            // the digit — see BADGE_EYE_OFFSET. A pure z offset leaves the
            // projected position untouched, so this costs nothing in placement.
            eyeOffset: BADGE_EYE_OFFSET,
          },
        })
      );
    });

    // --- declutter pass ---
    const windowScratch = new Cartesian2();
    const leaderTargetScratch = new Cartesian2();
    const rayScratch = new Ray();
    const placed: ScreenBox[] = [];

    const layoutLabels = () => {
      const scene = viewer.scene;
      placed.length = 0;

      // The wind label is fixed, so it claims its space first. Its vertical
      // origin is TOP, meaning it hangs below its anchor rather than sitting
      // above it like the station labels.
      const windWindow = SceneTransforms.worldToWindowCoordinates(
        scene,
        windLabel.anchor,
        windowScratch
      );
      if (windWindow) {
        const top = windWindow.y + windLabel.offsetY;
        placed.push({
          left: windWindow.x - windLabel.halfWidth,
          right: windWindow.x + windLabel.halfWidth,
          top,
          bottom: top + windLabel.height,
        });
      }

      for (const layout of badgeLayouts) {
        const window = SceneTransforms.worldToWindowCoordinates(
          scene,
          layout.anchor,
          windowScratch
        );
        // Behind the camera or otherwise unprojectable. Reset to rest so the
        // badge is in a sane place the moment it comes back into view.
        if (!window) {
          layout.offset.y = BADGE_RESTING_OFFSET_PX;
          layout.showLeader = false;
          continue;
        }

        // The box has to be the size the badge will actually draw at, which is
        // the distance-scaled size.
        const cameraDistance = Cartesian3.distance(
          scene.camera.positionWC,
          layout.anchor
        );
        const half =
          (BADGE_DIAMETER_PX *
            nearFarValue(BADGE_SCALE_BY_DISTANCE, cameraDistance)) /
          2;
        const boxAt = (offsetY: number): ScreenBox => {
          const centre = window.y + offsetY;
          return {
            left: window.x - half,
            right: window.x + half,
            top: centre - half,
            bottom: centre + half,
          };
        };

        let offsetY = BADGE_RESTING_OFFSET_PX;
        let resolved: ScreenBox | null = null;
        // Each iteration moves strictly upward, so this terminates; the guard
        // only bounds pathological input.
        for (let attempt = 0; attempt < 64; attempt++) {
          const box = boxAt(offsetY);
          const blocker = placed.find((other) => boxesOverlap(box, other));
          if (!blocker) {
            resolved = box;
            break;
          }
          // Lift so this badge's bottom edge clears the blocker's top edge.
          const lifted = blocker.top - BADGE_MIN_GAP_PX - half - window.y;
          if (BADGE_RESTING_OFFSET_PX - lifted > MAX_BADGE_PUSH_PX) break;
          offsetY = lifted;
        }

        if (!resolved) {
          // No clear spot within the push budget. Fall back to the station's
          // true position rather than hide the badge or leave it parked at some
          // arbitrary intermediate height.
          offsetY = BADGE_RESTING_OFFSET_PX;
          resolved = boxAt(offsetY);
        }
        placed.push(resolved);

        layout.offset.y = offsetY;
        layout.showLeader =
          BADGE_RESTING_OFFSET_PX - offsetY > LEADER_VISIBLE_BEYOND_PX;

        if (layout.showLeader) {
          // World point that projects to the badge's bottom edge. Taking it
          // along the pick ray at the station's own distance keeps the leader
          // in the station's depth plane, so it neither floats in front of
          // terrain nor sinks behind it.
          leaderTargetScratch.x = window.x;
          leaderTargetScratch.y = window.y + offsetY + half;
          const ray = scene.camera.getPickRay(leaderTargetScratch, rayScratch);
          if (ray) {
            Ray.getPoint(ray, cameraDistance, layout.leaderEnd);
          } else {
            layout.showLeader = false;
          }
        }
      }
    };

    layoutLabels();
    viewer.scene.preRender.addEventListener(layoutLabels);

    return () => {
      if (viewer.isDestroyed()) return;
      viewer.scene.preRender.removeEventListener(layoutLabels);
      for (const entity of created) {
        viewer.entities.remove(entity);
      }
    };
  }, [viewer, selectedFire]);

  return null;
}
