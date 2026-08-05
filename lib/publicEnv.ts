/**
 * Client-visible configuration.
 *
 * These two values carry the `NEXT_PUBLIC_` prefix, which means Next inlines
 * them into the browser bundle at build time — they are readable by anyone
 * with devtools, by design, because Cesium calls Google and Cesium Ion
 * directly from the page.
 *
 * They cannot live in `server/config.ts`: that module is `server-only`, and
 * this one is imported by client code. Server-side secrets belong there, not
 * here. Both are optional — the globe degrades to a bare ellipsoid rather
 * than throwing when a key is absent.
 *
 * The `process.env.X` expressions must stay written out in full; Next
 * substitutes them textually, so a dynamic lookup would not be inlined.
 */

export const publicEnv = {
  cesiumIonToken: process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN,
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
} as const;
