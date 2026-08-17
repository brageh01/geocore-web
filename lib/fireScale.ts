/**
 * The fire radiative power scale — one definition, shared by the globe and the
 * panels.
 *
 * Split out of FireLayer for the same reason lib/aqiScale.ts is split out of
 * the AQI layer: FireLayer imports Cesium at module scope, and a panel that
 * imports it statically drags Cesium into the server render, which is exactly
 * what the `ssr: false` dynamic import of GlobeViewer exists to avoid. The ramp
 * therefore lives here as CSS colour strings, and FireLayer converts them to
 * Cesium Colors once at module load.
 *
 * Before this module existed the panel carried its own hand-copied ramp, and
 * the two had already drifted: the ACTIVE EVENTS dot and the globe marker were
 * different colours for the same fire.
 */

/**
 * FRP ramp, hottest first. `minFrp` is the inclusive lower bound in MW.
 *
 * Fully saturated and pushed toward red, with hue falling from 28deg to 5deg as
 * power rises, so the ramp reads as heat. The low end matters most: it is the
 * colour of the weakest detections, which are the majority, and a desaturated
 * peach at small sizes over pale terrain read as haze rather than as fire.
 */
export const FRP_COLOR_RAMP: readonly { minFrp: number; color: string }[] = [
  { minFrp: 100, color: "#FF1500" },
  { minFrp: 50, color: "#FF3300" },
  { minFrp: 20, color: "#FF4E00" },
  { minFrp: 5, color: "#FF6200" },
  { minFrp: 0, color: "#FF7A0A" },
];

/** The ramp colour for a detection, as a CSS colour string. */
export function frpToCssColor(frp: number): string {
  for (const stop of FRP_COLOR_RAMP) {
    if (frp >= stop.minFrp) return stop.color;
  }
  // Only reachable for a negative FRP, which FIRMS does not report.
  return FRP_COLOR_RAMP[FRP_COLOR_RAMP.length - 1].color;
}

/**
 * Fire radiative power, in words.
 *
 * FRP is the radiative output of a single ~375 m VIIRS pixel, so the numbers
 * are much smaller than a whole fire's energy and "1603 MW" tells a layperson
 * nothing. Most detections in a normal scene sit under 10 MW; anything over
 * 100 MW is a genuinely intense pixel and four figures is exceptional — the
 * fixture's largest is 1603 MW. Thresholds are set to spread the top of the
 * list across more than one word rather than to match any published standard,
 * of which there is none for per-pixel FRP.
 *
 * The vocabulary has to satisfy two constraints at once. It must be orderable
 * on sight, and it must not collide with the EPA air-quality categories shown
 * in the impact panel on the same screen — two unrelated scales sharing a word
 * invites a first-time viewer to read them as one scale. The original ladder
 * (Extreme / Major / Significant / Moderate / Minor) failed the second: EPA
 * uses "Moderate". A combustion vocabulary (Smouldering / Blazing / Raging)
 * fixed that but failed the first — almost nobody can confidently rank
 * "Blazing" against "Raging".
 *
 * Extreme > Severe > High > Elevated > Low satisfies both: it is a plain
 * intensity ordering everyone already knows, and none of the five words appear
 * among the EPA categories (Good, Moderate, Unhealthy for sensitive groups,
 * Unhealthy, Very unhealthy, Hazardous).
 */
export function frpIntensityLabel(frp: number): string {
  if (frp >= 1000) return "Extreme";
  if (frp >= 300) return "Severe";
  if (frp >= 100) return "High";
  if (frp >= 25) return "Elevated";
  return "Low";
}
