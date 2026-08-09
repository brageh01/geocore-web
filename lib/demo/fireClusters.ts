/**
 * Group raw VIIRS detections into named fire events for the ACTIVE EVENTS list.
 *
 * A satellite detection is one ~375 m pixel that was hot on one pass, so a
 * single fire produces dozens of them a few kilometres apart. Listing them raw
 * meant the same fire filled the sidebar over and over with near-identical
 * coordinates, distinguishable only by FRP.
 *
 * This is a presentation concern only. The globe still draws every detection
 * individually — clustering here would throw away the texture of the fire
 * front, which is the thing that looks good on camera.
 */
import type { FireEvent } from "@/lib/contracts";

/** Detections within this distance of a cluster's seed join it. */
const CLUSTER_RADIUS_KM = 5;

// Spatial-hash cell size. Chosen so that anything within CLUSTER_RADIUS_KM is
// guaranteed to land in the 3x3 neighbourhood we scan: 0.045 deg of latitude is
// ~5 km everywhere, and 0.09 deg of longitude is ~5 km at 60N and more further
// south, so one cell in each axis always covers the search radius.
const CELL_LAT_DEG = 0.045;
const CELL_LON_DEG = 0.09;

const EARTH_RADIUS_KM = 6371;

export interface FireCluster {
  /** Stable across renders — the seed detection's id. */
  id: string;
  /**
   * The strongest detection in the cluster. Selecting a list entry selects
   * this, so the globe highlight and the impact briefing keep working on a
   * real FireEvent and the panel's Source FRP matches the figure listed here.
   */
  seed: FireEvent;
  detectionCount: number;
  /** Sum across the cluster. Not displayed — see the note on ranking below. */
  totalFrp: number;
  /** The seed's FRP, which is what the list and the briefing panel both show. */
  maxFrp: number;
  regionName: string;
  /** e.g. "Washington Complex 1" */
  label: string;
}

/**
 * Named regions, tested in order, first match wins.
 *
 * Deliberately finer than the three fixture bboxes. The fixture's "British
 * Columbia" box starts at 48N, which puts the largest fires in the whole
 * dataset — the 1603 MW cluster at 48.03N — inside it, but they are in
 * Washington state. The 49th parallel is the actual border, so splitting there
 * gives labels that are true rather than merely convenient.
 */
const NAMED_REGIONS: {
  name: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}[] = [
  { name: "Washington", minLat: 45.5, maxLat: 49.0, minLon: -125, maxLon: -116 },
  { name: "Oregon", minLat: 42.0, maxLat: 45.5, minLon: -125, maxLon: -116 },
  { name: "British Columbia", minLat: 49.0, maxLat: 60.0, minLon: -139, maxLon: -114 },
  { name: "California", minLat: 32.0, maxLat: 42.0, minLon: -125, maxLon: -114 },
  { name: "Iberia", minLat: 36.0, maxLat: 44.0, minLon: -10, maxLon: 4 },
];

function regionNameFor(fire: FireEvent): string {
  for (const region of NAMED_REGIONS) {
    if (
      fire.latitude >= region.minLat &&
      fire.latitude < region.maxLat &&
      fire.longitude >= region.minLon &&
      fire.longitude <= region.maxLon
    ) {
      return region.name;
    }
  }
  return "Unclassified";
}

function haversineKm(a: FireEvent, b: FireEvent): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface MutableCluster {
  seed: FireEvent;
  detectionCount: number;
  totalFrp: number;
}

/**
 * Cluster detections and return the largest events, strongest first.
 *
 * Ranked and labelled by the seed's FRP rather than by the cluster total: the
 * briefing panel derives everything from the seed detection, and a list that
 * said 4200 MW next to a panel that said 1603 MW would just look broken on
 * camera. detectionCount is surfaced instead, so the grouping stays visible.
 */
export function clusterFireEvents(
  fires: FireEvent[],
  maxEntries: number
): FireCluster[] {
  // Strongest first, so each cluster is seeded by its most intense detection.
  const sorted = [...fires].sort((a, b) => b.frp - a.frp);

  const clusters: MutableCluster[] = [];
  // cell key -> indices of cluster seeds sitting in that cell
  const buckets = new Map<string, number[]>();

  for (const fire of sorted) {
    const latCell = Math.floor(fire.latitude / CELL_LAT_DEG);
    const lonCell = Math.floor(fire.longitude / CELL_LON_DEG);

    let joined = -1;
    for (let dy = -1; dy <= 1 && joined < 0; dy++) {
      for (let dx = -1; dx <= 1 && joined < 0; dx++) {
        const indices = buckets.get(`${latCell + dy}_${lonCell + dx}`);
        if (!indices) continue;
        for (const index of indices) {
          if (haversineKm(fire, clusters[index].seed) <= CLUSTER_RADIUS_KM) {
            joined = index;
            break;
          }
        }
      }
    }

    if (joined >= 0) {
      clusters[joined].detectionCount += 1;
      clusters[joined].totalFrp += fire.frp;
      continue;
    }

    const index = clusters.length;
    clusters.push({ seed: fire, detectionCount: 1, totalFrp: fire.frp });
    const key = `${latCell}_${lonCell}`;
    const existing = buckets.get(key);
    if (existing) existing.push(index);
    else buckets.set(key, [index]);
  }

  // Seeds were taken in FRP order, so `clusters` is already ranked.
  const top = clusters.slice(0, maxEntries);

  const perRegionCount = new Map<string, number>();
  return top.map((cluster) => {
    const regionName = regionNameFor(cluster.seed);
    const ordinal = (perRegionCount.get(regionName) ?? 0) + 1;
    perRegionCount.set(regionName, ordinal);

    return {
      id: cluster.seed.id,
      seed: cluster.seed,
      detectionCount: cluster.detectionCount,
      totalFrp: cluster.totalFrp,
      maxFrp: cluster.seed.frp,
      regionName,
      label: `${regionName} Complex ${ordinal}`,
    };
  });
}
