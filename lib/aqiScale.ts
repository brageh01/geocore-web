/**
 * The EPA air-quality scale — one definition, shared by everything that needs it.
 *
 * This module is deliberately free of Cesium and of any `server/` import, which
 * is what lets all three consumers share it:
 *   - `server/sources/openaq.ts` converts upstream µg/m³ readings to AQI
 *   - `components/globe/AQILayer.tsx` colours station billboards
 *   - React panels colour text and category chips
 *
 * The panels are the reason this is a separate module rather than living in
 * AQILayer: that file imports Cesium at module scope, and pulling Cesium into a
 * statically-imported panel drags it into the server render, which is exactly
 * what the `ssr: false` dynamic import of GlobeViewer exists to avoid.
 *
 * https://www.airnow.gov/aqi/aqi-basics/
 */

/** EPA AQI colour scale, as a CSS colour string. */
export function aqiToColor(aqi: number): string {
  if (aqi <= 50) return "#00E400"; // Good — green
  if (aqi <= 100) return "#FFFF00"; // Moderate — yellow
  if (aqi <= 150) return "#FF7E00"; // Unhealthy for Sensitive — orange
  if (aqi <= 200) return "#FF0000"; // Unhealthy — red
  if (aqi <= 300) return "#8F3F97"; // Very Unhealthy — purple
  return "#7E0023"; // Hazardous — maroon
}

/**
 * The EPA category name, spelled out. Note "USG" is deliberately absent — the
 * official abbreviation is meaningless to anyone who has not read the standard,
 * and these strings are shown to first-time viewers.
 */
/**
 * The same scale, lifted for use as text on the near-black background.
 *
 * The official colours are chosen to sit next to each other as filled blocks,
 * not to be read as type on #0a0a0a: "Hazardous" maroon (#7E0023) and "Very
 * unhealthy" purple (#8F3F97) both disappear at small sizes. Swatches and the
 * legend keep the true EPA colours; only glyphs use these.
 */
export function aqiToTextColor(aqi: number): string {
  if (aqi <= 50) return "#00E400";
  if (aqi <= 100) return "#FFFF00";
  if (aqi <= 150) return "#FF7E00";
  if (aqi <= 200) return "#FF4D4D";
  if (aqi <= 300) return "#C77DCE";
  return "#F2557A";
}

export function aqiCategoryName(aqi: number): string {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for sensitive groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very unhealthy";
  return "Hazardous";
}

/**
 * The same category as a sentence fragment, for prose. Reads as the tail of
 * "The air there is 14.6 times dirtier than clean air — ...".
 */
export function aqiCategoryPhrase(aqi: number): string {
  if (aqi <= 50) return "which still counts as good air";
  if (aqi <= 100) return "acceptable for most people";
  if (aqi <= 150) return "unhealthy for sensitive groups";
  if (aqi <= 200) return "unhealthy for everyone";
  if (aqi <= 300) return "very unhealthy for everyone";
  // No dash in this one: the sentence already joins it with an em dash, and
  // "clean air — hazardous — everyone should stay indoors" read as a stutter.
  return "hazardous for everyone";
}

/** Short label for the legend strip, where a full name will not fit. */
export function aqiCategoryShortName(aqi: number): string {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Sensitive groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very unhealthy";
  return "Hazardous";
}

/**
 * The six EPA bands, for drawing a legend. `upperAqi` is the top of the band;
 * the last is open-ended and capped at the scale maximum.
 */
export const AQI_BANDS = [50, 100, 150, 200, 300, 500].map((upperAqi) => ({
  upperAqi,
  color: aqiToColor(upperAqi),
  name: aqiCategoryShortName(upperAqi),
  fullName: aqiCategoryName(upperAqi),
}));

/**
 * Convert a PM2.5 concentration (µg/m³) to an AQI index using EPA breakpoints,
 * including the 2024 revision to the 0–9.0 lower band.
 */
export function pm25ToAQI(pm25: number): number {
  const breakpoints: [number, number, number, number][] = [
    // [pm25_low, pm25_high, aqi_low, aqi_high]
    [0.0, 9.0, 0, 50],
    [9.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 125.4, 151, 200],
    [125.5, 225.4, 201, 300],
    [225.5, 325.4, 301, 500],
  ];

  if (pm25 < 0) return 0;
  if (pm25 > 325.4) return 500;

  for (const [cLow, cHigh, iLow, iHigh] of breakpoints) {
    if (pm25 >= cLow && pm25 <= cHigh) {
      return Math.round(
        ((iHigh - iLow) / (cHigh - cLow)) * (pm25 - cLow) + iLow
      );
    }
  }

  return 0;
}
