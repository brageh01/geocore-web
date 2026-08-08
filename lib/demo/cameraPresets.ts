/**
 * Camera choreography for the demo — presets, idle rotation timing, and the
 * shared "the user just did something" clock.
 *
 * The interaction timestamp lives in a module variable rather than in the
 * Zustand store deliberately: it is written on every wheel tick and pointer
 * press, and putting that in the store would re-render the tree on each one.
 */

/** Target framings. Coordinates are FRP-weighted centroids of the fixture's
 *  three regional clusters, so each flight lands on actual fire density. */
export interface CameraPreset {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  /** Camera distance from the target, metres. */
  rangeM: number;
  /** Compass heading, degrees. Chosen per-region so the flight arrives looking
   *  across the terrain rather than along a featureless axis. */
  headingDeg: number;
  /** Negative is looking down. Well short of -90 so relief stays readable. */
  pitchDeg: number;
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: "california",
    label: "California",
    latitude: 38.35,
    longitude: -118.8,
    rangeM: 620_000,
    headingDeg: 20,
    pitchDeg: -36,
  },
  {
    id: "british-columbia",
    label: "British Columbia",
    latitude: 49.88,
    longitude: -120.92,
    rangeM: 600_000,
    headingDeg: -15,
    pitchDeg: -34,
  },
  {
    id: "iberia",
    label: "Iberia",
    latitude: 38.44,
    longitude: -6.47,
    rangeM: 560_000,
    headingDeg: 35,
    pitchDeg: -38,
  },
];

/** Seconds a preset flight takes. */
export const PRESET_FLIGHT_SECONDS = 2.5;

/** Seconds the flight to a freshly selected fire takes — gentler than a jump
 *  between regions, since the camera is usually already nearby. */
export const SELECTION_FLIGHT_SECONDS = 2.0;

/** Viewing angle used when framing a fire and its impact links. Shallower than
 *  the presets so the upward bow of the arcs reads instead of flattening. */
export const SELECTION_PITCH_DEG = -45;
export const SELECTION_HEADING_DEG = 0;

/** The links must stay comfortably inside the frame, so the camera pulls back
 *  past the bounding sphere that encloses the fire and every station. */
export const SELECTION_RANGE_PADDING = 2.6;

/** Idle before the globe starts turning again. */
export const IDLE_DELAY_MS = 3000;

/** One full revolution per minute. */
export const ROTATION_PERIOD_SECONDS = 60;
export const ROTATION_RAD_PER_SECOND = (2 * Math.PI) / ROTATION_PERIOD_SECONDS;

// --- interaction clock ------------------------------------------------------

let lastInteractionAt = 0;
let flightsInProgress = 0;

/** Called on any user input, and at the start/end of a scripted flight. */
export function markCameraInteraction(): void {
  lastInteractionAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function msSinceInteraction(): number {
  const now =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  return now - lastInteractionAt;
}

export function beginScriptedFlight(): void {
  flightsInProgress += 1;
  markCameraInteraction();
}

export function endScriptedFlight(): void {
  flightsInProgress = Math.max(0, flightsInProgress - 1);
  // Restart the idle countdown from touchdown rather than from the click, so
  // the globe does not begin turning half a second after it lands.
  markCameraInteraction();
}

export function isFlightInProgress(): boolean {
  return flightsInProgress > 0;
}

/** True when the globe should be turning on its own. */
export function shouldIdleRotate(): boolean {
  return !isFlightInProgress() && msSinceInteraction() >= IDLE_DELAY_MS;
}
