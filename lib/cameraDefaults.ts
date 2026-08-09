/**
 * The camera the app opens on, and the one RESET VIEW returns to.
 *
 * Plain numbers, no Cesium import: `lib/cesium.ts` consumes this to set the
 * initial view, and so does the top bar's reset button, which renders outside
 * the `ssr: false` boundary and must not drag Cesium into the server render.
 *
 * Centred over the Atlantic rather than over land. The previous default looked
 * straight down at 35N 100W, which after any rotation left the camera over Asia
 * where the fixture has no data at all. From 45N 60W at 8000 km the horizon
 * reaches ~63 degrees of arc, and all three fixture regions sit inside it:
 * British Columbia ~40 degrees away, California ~43, Iberia ~39. So both the
 * North American and the Iberian clusters are on screen at load.
 */
export const DEFAULT_CAMERA = {
  longitude: -60,
  latitude: 45,
  /** Metres above the ellipsoid. */
  height: 8_000_000,
  headingDeg: 0,
  /** Straight down — a globe view, not an oblique one. */
  pitchDeg: -90,
  rollDeg: 0,
} as const;

/** Seconds the RESET VIEW flight takes. */
export const RESET_FLIGHT_SECONDS = 2.5;
