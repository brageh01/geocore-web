/**
 * Name a place from its coordinates.
 *
 * Region labels used to come from whichever fixture bbox a detection was
 * *fetched* in, which made them wrong wherever a bbox spanned a border. The
 * "California" bbox reaches to 114W, so fires in Nevada were labelled
 * California; the "British Columbia" bbox starts at 48N, so fires in Washington
 * were labelled Canadian; and the "Iberia" bbox dips to 36N, which put
 * detections in Algeria under a European heading.
 *
 * There is no geocoder here, so these are hand-built bounds covering the ground
 * the fixture actually touches. They are approximations — good to a few tens of
 * kilometres, which is all a label on a list needs — and anything that matches
 * nothing falls back to formatted coordinates rather than guessing.
 */

export interface RegionMatch {
  /** Ordered; the first region that contains the point wins. */
  name: string;
  contains: (latitude: number, longitude: number) => boolean;
}

const between = (v: number, lo: number, hi: number) => v >= lo && v <= hi;

/** Linear interpolation of a border longitude between two latitudes. */
function borderLon(
  latitude: number,
  latA: number,
  lonA: number,
  latB: number,
  lonB: number
): number {
  const t = (latitude - latA) / (latB - latA);
  return lonA + (lonB - lonA) * t;
}

/**
 * BC's eastern border is the Continental Divide from (49, -114.05) up to
 * (54, -120), then the 120W meridian northward. A plain rectangle would have
 * put the southern BC fires — which sit around 118W — into Alberta.
 */
function bcEasternLon(latitude: number): number {
  if (latitude >= 54) return -120;
  return borderLon(latitude, 49, -114.05, 54, -120);
}

/**
 * Nevada's western border runs down the 120W meridian to 39N, then diagonally
 * to (35, -114.63). Without the diagonal, everything in the Mojave would be
 * called Nevada.
 */
function nevadaWesternLon(latitude: number): number {
  if (latitude >= 39) return -120;
  return borderLon(latitude, 39, -120, 35, -114.63);
}

/** Portugal's eastern border, roughly, from the Algarve up to Minho. */
function portugalEasternLon(latitude: number): number {
  if (latitude < 39) return borderLon(latitude, 37.0, -7.45, 39, -7.0);
  return borderLon(latitude, 39, -7.0, 42.15, -6.2);
}

const REGIONS: RegionMatch[] = [
  // --- western North America ---
  {
    name: "British Columbia",
    contains: (lat, lon) =>
      between(lat, 48.99, 60) && lon >= -139 && lon <= bcEasternLon(lat),
  },
  {
    name: "Alberta",
    contains: (lat, lon) =>
      between(lat, 48.99, 60) && lon > bcEasternLon(lat) && lon <= -110,
  },
  {
    name: "Washington",
    contains: (lat, lon) =>
      between(lat, 45.54, 48.99) && between(lon, -124.85, -116.92),
  },
  {
    name: "Oregon",
    contains: (lat, lon) =>
      between(lat, 41.99, 46.3) && between(lon, -124.6, -116.46),
  },
  {
    // Two boxes, because Idaho is not a rectangle: the panhandle above 45.5N
    // only reaches 116.05W, while the southern half runs east to 111W. One
    // box put Montana detections around 48N 115W into Idaho.
    name: "Idaho",
    contains: (lat, lon) =>
      (between(lat, 45.5, 49) && between(lon, -117.25, -116.05)) ||
      (between(lat, 41.99, 45.5) && between(lon, -117.25, -111.05)),
  },
  {
    name: "Montana",
    contains: (lat, lon) =>
      between(lat, 44.35, 49) && between(lon, -116.05, -104.05),
  },
  {
    name: "Nevada",
    contains: (lat, lon) =>
      between(lat, 35, 42) && lon >= nevadaWesternLon(lat) && lon <= -114.04,
  },
  {
    name: "California",
    // 32.53N is the Mexican border at this longitude; starting at 32.5 claimed
    // detections just inside Baja California.
    contains: (lat, lon) =>
      between(lat, 32.53, 42) && lon >= -124.5 && lon < nevadaWesternLon(lat),
  },
  {
    name: "Utah",
    contains: (lat, lon) =>
      between(lat, 36.99, 42) && between(lon, -114.05, -109.04),
  },
  {
    name: "Arizona",
    contains: (lat, lon) =>
      between(lat, 31.33, 37) && between(lon, -114.82, -109.04),
  },

  // --- Iberia and the North African coast the fixture bbox also caught ---
  {
    name: "Portugal",
    contains: (lat, lon) =>
      between(lat, 36.95, 42.15) &&
      lon >= -9.55 &&
      lon <= portugalEasternLon(lat),
  },
  // North Africa is tested BEFORE Spain. A box wide enough to hold mainland
  // Spain also covers the Mediterranean and the Algerian coast at 36-37N, so
  // Spain-first labelled detections near Algiers as Spanish.
  {
    name: "Morocco",
    contains: (lat, lon) => between(lat, 27, 35.95) && between(lon, -13, -1),
  },
  {
    name: "Algeria",
    contains: (lat, lon) => between(lat, 19, 37.1) && between(lon, -2, 9),
  },
  {
    name: "Spain",
    contains: (lat, lon) => between(lat, 36, 43.8) && between(lon, -9.3, 3.35),
  },

  {
    name: "Mexico",
    contains: (lat, lon) => between(lat, 14, 32.72) && between(lon, -118, -86),
  },
];

/** Formatted coordinates, used when nothing matches. Never guesses. */
export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(1)}°${latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(longitude).toFixed(1)}°${longitude >= 0 ? "E" : "W"}`;
  return `${lat} ${lon}`;
}

export function regionNameFor(latitude: number, longitude: number): string {
  for (const region of REGIONS) {
    if (region.contains(latitude, longitude)) return region.name;
  }
  return formatCoordinates(latitude, longitude);
}
