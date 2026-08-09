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
import { regionNameFor } from "@/lib/demo/regions";

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
 * Cluster every detection and return all events, strongest first.
 *
 * Ranked and labelled by the seed's FRP rather than by the cluster total: the
 * briefing panel derives everything from the seed detection, and a list that
 * said 4200 MW next to a panel that said 1603 MW would just look broken on
 * camera. detectionCount is surfaced instead, so the grouping stays visible.
 *
 * Returns the full set rather than a top slice, and numbers labels across the
 * whole set, so a cluster's name does not change depending on how many rows
 * happen to be on screen. A fire selected from the globe can sit far down this
 * list and still carry the same label the list would have given it.
 */
export function clusterFireEvents(fires: FireEvent[]): FireCluster[] {
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
  const perRegionCount = new Map<string, number>();
  return clusters.map((cluster) => {
    const regionName = regionNameFor(
      cluster.seed.latitude,
      cluster.seed.longitude
    );
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

/**
 * The cluster a given detection belongs to, or null.
 *
 * Needed because a fire can be selected by clicking a point on the globe, which
 * is usually *not* the cluster's seed — matching the list highlight on seed id
 * alone left the sidebar showing nothing selected while the panel was full.
 * Every member of a cluster is within CLUSTER_RADIUS_KM of its seed by
 * construction, so the nearest seed inside that radius is the right answer.
 */
export function findClusterForFire(
  clusters: FireCluster[],
  fire: FireEvent
): FireCluster | null {
  let best: FireCluster | null = null;
  let bestDistance = Infinity;

  for (const cluster of clusters) {
    if (cluster.seed.id === fire.id) return cluster;
    const distance = haversineKm(fire, cluster.seed);
    if (distance <= CLUSTER_RADIUS_KM && distance < bestDistance) {
      bestDistance = distance;
      best = cluster;
    }
  }

  return best;
}

// Both the active-events list and the impact briefing need the clustering, and
// `fires` is a stable reference in demo mode, so cache on array identity rather
// than clustering 10k detections twice per render.
let cachedInput: FireEvent[] | null = null;
let cachedOutput: FireCluster[] | null = null;

export function clusterFireEventsCached(fires: FireEvent[]): FireCluster[] {
  if (cachedInput === fires && cachedOutput) return cachedOutput;
  cachedOutput = clusterFireEvents(fires);
  cachedInput = fires;
  return cachedOutput;
}
