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

export function aqiCategory(aqi: number): string {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "USG";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

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
