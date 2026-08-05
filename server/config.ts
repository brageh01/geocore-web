import "server-only";
import { MissingEnvError } from "@/server/errors";

/**
 * Server-side configuration.
 *
 * Every server-side `process.env` read in the codebase goes through here, so
 * there is one place to see what the backend needs and one error message when
 * something is missing.
 *
 * The two `NEXT_PUBLIC_*` variables are deliberately NOT here — they are
 * inlined into the browser bundle at build time and are read by client code
 * (`lib/cesium.ts`), which cannot import a `server-only` module. They live in
 * `lib/publicEnv.ts` instead.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new MissingEnvError(name);
  return value;
}

export const serverConfig = {
  /** NASA FIRMS MAP_KEY — active-fire CSV API. */
  get nasaFirmsApiKey(): string {
    return requireEnv("NASA_FIRMS_API_KEY");
  },
  /** OpenAQ v3 API key — sent as the X-API-Key header. */
  get openaqApiKey(): string {
    return requireEnv("OPENAQ_API_KEY");
  },
};
