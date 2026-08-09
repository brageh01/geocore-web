/**
 * Simulated downwind air-quality impact for a fire — demo mode only.
 *
 * This fabricates data. It is not a plume model and none of the numbers are
 * measurements; the UI labels every surface that shows them as SIMULATED. The
 * point is to make the cause-and-effect story legible on camera while the real
 * fusion engine does not exist.
 *
 * Everything here is a pure function of the fire's id, so the same fire always
 * produces the same stations with the same values. That matters for a
 * recording: values derived from Math.random() would flicker on every React
 * re-render and make the footage unusable.
 */
import type { AQIStation, FireEvent } from "@/lib/contracts";
import { pm25ToAQI } from "@/lib/aqiScale";

/** Clean-air reference the headline multiplier is quoted against, in µg/m³. */
export const BASELINE_PM25_UGM3 = 6;

const MIN_STATIONS = 3;
const MAX_STATIONS = 6;
const MIN_DISTANCE_KM = 20;
const MAX_DISTANCE_KM = 150;

// e-folding distance of the concentration falloff. At 60 km a plume has decayed
// to ~37% of its near-source excess, which puts the far stations in "Moderate"
// while the near ones sit in "Unhealthy" — a readable spread across the EPA
// scale rather than everything saturating the same colour.
const PLUME_DECAY_KM = 60;

// Scales sqrt(FRP) into µg/m³. Tuned so a ~300 MW detection reads around
// 20-25x baseline at its nearest station, which is the range real wildfire
// smoke events actually produce.
const PLUME_INTENSITY = 12.3;

// Concentrations above this are physically possible but read as broken on a
// dashboard, and the EPA scale tops out at 325.4 µg/m³ anyway.
const MAX_PM25_UGM3 = 400;

// Concentration and fire radiative power are unrelated quantities that happen
// to share a numeric range, so the two can coincide by chance — measured, 2 of
// the fixture's 10,277 fires produced a worst-station PM2.5 that printed
// identically to the fire's FRP, and a panel reading "87.6 MW" above
// "87.6 µg/m³" reads as a bug whether or not it is one. Any station landing
// within this many µg/m³ of the FRP figure is nudged clear.
const FRP_COLLISION_WINDOW = 1.0;
// Size of the nudge, as a fraction. Sits inside the existing ±12% jitter band,
// so it cannot push a reading outside what the model would already produce.
const FRP_COLLISION_NUDGE = 0.08;

// The plume is a cone, not a scatter: near stations sit close to the downwind
// bearing, far ones spread out.
const CONE_HALF_ANGLE_NEAR_DEG = 8;
const CONE_HALF_ANGLE_FAR_DEG = 30;

const EARTH_RADIUS_KM = 6371;

/** A generated station, carrying the extra fields the briefing panel needs. */
export interface DemoAQIStation extends AQIStation {
  /** Simulated PM2.5 concentration in µg/m³. */
  pm25: number;
  /** Great-circle distance from the fire, km. */
  distanceKm: number;
  /** Bearing from the fire, degrees clockwise from north. */
  bearingDeg: number;
  /** pm25 / BASELINE_PM25_UGM3 — the headline number. */
  baselineMultiplier: number;
}

export interface DemoImpact {
  fireId: string;
  /** The single bearing the plume is drawn along. */
  downwindBearingDeg: number;
  /** Sorted nearest first. */
  stations: DemoAQIStation[];
  /** Highest PM2.5 of the set — drives the headline. */
  worst: DemoAQIStation;
}

// --- deterministic RNG ------------------------------------------------------

/** FNV-1a. Turns a fire id into a stable 32-bit seed. */
function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good enough, and fully reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- geography --------------------------------------------------------------

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle destination from a point given a bearing and distance. */
function destination(
  latitude: number,
  longitude: number,
  bearingDeg: number,
  distanceKm: number
): { latitude: number; longitude: number } {
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
    // Normalise into [-180, 180) so a plume crossing the antimeridian does not
    // produce a longitude Cesium will draw the long way around the planet.
    longitude: ((toDeg(lon2) + 540) % 360) - 180,
  };
}

// --- naming -----------------------------------------------------------------

// Deliberately generic compound place names. They read like the monitoring
// sites they stand in for without borrowing a real station's identity, which
// would imply these fabricated readings came from somewhere.
const NAME_HEAD = [
  "Cedar", "Willow", "Ash", "Pine", "Summit", "Clearwater", "North Fork",
  "Elk", "Silver", "Granite", "Fairview", "Aspen", "Birch", "Redstone",
  "Juniper", "Millbrook", "Stonegate", "Larkfield",
];
const NAME_TAIL = [
  "Creek", "Ridge", "Valley", "Hollow", "Flats", "Springs", "Bend", "Grove",
  "Basin", "Crossing", "Mesa", "Falls", "Junction", "Park", "Landing",
];

function pickName(rng: () => number, used: Set<string>): string {
  for (let attempt = 0; attempt < 24; attempt++) {
    const name = `${NAME_HEAD[Math.floor(rng() * NAME_HEAD.length)]} ${
      NAME_TAIL[Math.floor(rng() * NAME_TAIL.length)]
    }`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  // Exhausting 24 attempts needs a pathological seed, but a duplicate name on
  // screen is worse than an ugly one.
  const fallback = `Station ${used.size + 1}`;
  used.add(fallback);
  return fallback;
}

// --- generation -------------------------------------------------------------

// Generated impacts are cached by fire id so repeated calls return the *same
// array reference*. The Cesium layer keys its entity rebuild on that identity;
// a fresh array per render would tear down and re-animate every link on any
// unrelated state change.
const impactCache = new Map<string, DemoImpact>();
const MAX_CACHED_IMPACTS = 200;

export function getDemoImpact(fire: FireEvent): DemoImpact {
  const cached = impactCache.get(fire.id);
  if (cached) return cached;

  const rng = mulberry32(hashString(fire.id));

  const count =
    MIN_STATIONS + Math.floor(rng() * (MAX_STATIONS - MIN_STATIONS + 1));
  const downwindBearingDeg = rng() * 360;
  const usedNames = new Set<string>();

  const stations: DemoAQIStation[] = [];

  for (let i = 0; i < count; i++) {
    // Spread stations along the plume axis, nearest first, with jitter so the
    // spacing does not look mechanically even.
    const along = (i + 0.35 + rng() * 0.5) / count;
    const distanceKm =
      MIN_DISTANCE_KM +
      (MAX_DISTANCE_KM - MIN_DISTANCE_KM) * Math.pow(along, 1.25);

    // Cone widens with distance.
    const halfAngle =
      CONE_HALF_ANGLE_NEAR_DEG +
      (CONE_HALF_ANGLE_FAR_DEG - CONE_HALF_ANGLE_NEAR_DEG) *
        (distanceKm / MAX_DISTANCE_KM);
    const bearingDeg = downwindBearingDeg + (rng() * 2 - 1) * halfAngle;

    const { latitude, longitude } = destination(
      fire.latitude,
      fire.longitude,
      bearingDeg,
      distanceKm
    );

    // Concentration decays exponentially with distance and grows with the
    // square root of fire radiative power — sub-linear, so a 10x fire is not a
    // 10x reading.
    const decay = Math.exp(-distanceKm / PLUME_DECAY_KM);
    const jitter = 0.88 + rng() * 0.24;
    const pm25 = Math.min(
      MAX_PM25_UGM3,
      BASELINE_PM25_UGM3 +
        PLUME_INTENSITY * Math.sqrt(Math.max(fire.frp, 1)) * decay * jitter
    );

    const rounded =
      Math.round(avoidFrpCollision(pm25, fire.frp) * 10) / 10;

    stations.push({
      id: `demo-aqi-${fire.id}-${i}`,
      name: pickName(rng, usedNames),
      latitude,
      longitude,
      aqi: pm25ToAQI(rounded),
      parameter: "pm25",
      // Tie the reading to the detection rather than to wall-clock time, so it
      // does not drift between renders.
      lastUpdated: `${fire.acq_date} ${formatAcqTime(fire.acq_time)} UTC`,
      pm25: rounded,
      distanceKm: Math.round(distanceKm * 10) / 10,
      bearingDeg,
      baselineMultiplier: Math.round((rounded / BASELINE_PM25_UGM3) * 10) / 10,
    });
  }

  stations.sort((a, b) => a.distanceKm - b.distanceKm);

  const worst = stations.reduce((a, b) => (b.pm25 > a.pm25 ? b : a), stations[0]);

  const impact: DemoImpact = {
    fireId: fire.id,
    downwindBearingDeg,
    stations,
    worst,
  };

  // Bound the cache. Clicking 200 distinct fires in one recording is not going
  // to happen, but an unbounded Map keyed on user input is a bad habit.
  if (impactCache.size >= MAX_CACHED_IMPACTS) {
    const oldest = impactCache.keys().next().value;
    if (oldest !== undefined) impactCache.delete(oldest);
  }
  impactCache.set(fire.id, impact);

  return impact;
}

/**
 * Move a concentration clear of the fire's FRP figure.
 *
 * Purely a presentation guard: PM2.5 stays a function of FRP and distance, and
 * the shift is smaller than the model's own jitter. It only ever fires for the
 * handful of readings that would otherwise print the same number as the FRP
 * shown directly above them in the panel.
 */
function avoidFrpCollision(pm25: number, frp: number): number {
  if (Math.abs(pm25 - frp) >= FRP_COLLISION_WINDOW) return pm25;

  // Push away from the FRP rather than toward it, so the nudge never carries
  // the value across and collides again on the other side.
  const nudged =
    pm25 >= frp
      ? pm25 * (1 + FRP_COLLISION_NUDGE)
      : pm25 * (1 - FRP_COLLISION_NUDGE);

  const clamped = Math.min(MAX_PM25_UGM3, Math.max(BASELINE_PM25_UGM3, nudged));

  // Clamping at either end could in principle land back on the FRP figure.
  return Math.abs(clamped - frp) < 0.1 ? clamped + 0.2 : clamped;
}

/** FIRMS reports acquisition time as an unpadded HHMM string ("934" = 09:34). */
export function formatAcqTime(acqTime: string): string {
  const padded = acqTime.padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
}
