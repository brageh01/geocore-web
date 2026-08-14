/**
 * Client-visible configuration.
 *
 * This value carries the `NEXT_PUBLIC_` prefix, which means Next inlines it
 * into the browser bundle at build time — it is readable by anyone with
 * devtools, by design, because Cesium calls Cesium Ion directly from the page.
 *
 * It cannot live in `server/config.ts`: that module is `server-only`, and this
 * one is imported by client code. Server-side secrets belong there, not here.
 * It is optional — without a token Ion refuses the terrain and imagery
 * requests and the globe degrades to a bare ellipsoid rather than throwing.
 *
 * The `process.env.X` expression must stay written out in full; Next
 * substitutes it textually, so a dynamic lookup would not be inlined.
 */

export const publicEnv = {
  cesiumIonToken: process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN,
} as const;
