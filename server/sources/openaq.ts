import "server-only";
import { serverConfig } from "@/server/config";
import { UpstreamError } from "@/server/errors";
import type { AQIStation } from "@/lib/contracts";
import { pm25ToAQI } from "@/lib/aqiScale";

/**
 * OpenAQ air-quality source.
 *
 * Endpoint: GET https://api.openaq.org/v3/locations
 * Auth: X-API-Key header (set OPENAQ_API_KEY in .env.local)
 * Rate limits: 60 requests/minute, 2000/hour on the free tier.
 * CORS: Not an issue since this only ever runs server-side.
 *
 * We fetch locations that measure PM2.5 (parameter_id=2) since it's the
 * most relevant AQI parameter for wildfire smoke impact.
 */

const OPENAQ_BASE = "https://api.openaq.org/v3";
const REQUEST_TIMEOUT_MS = 30_000;

export interface FetchAQIStationsOptions {
  /** Bounding box as "west,south,east,north" in degrees. */
  bbox: string;
  /** Maximum stations to request, already capped by the caller. */
  limit: number;
}

export async function fetchAQIStations({
  bbox,
  limit,
}: FetchAQIStationsOptions): Promise<AQIStation[]> {
  // parameter_id=2 is PM2.5 in OpenAQ
  const params = new URLSearchParams({
    limit: String(limit),
    page: "1",
    parameter_id: "2",
    bbox,
  });

  const url = `${OPENAQ_BASE}/locations?${params}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "X-API-Key": serverConfig.openaqApiKey },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new UpstreamError("OpenAQ request timed out after 30 seconds", 504);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text();
    console.error("OpenAQ API error:", response.status, text);
    throw new UpstreamError(
      `OpenAQ API returned ${response.status}`,
      response.status
    );
  }

  return parseOpenAQResponse(await response.json());
}

interface OpenAQLocation {
  id: number;
  name: string;
  coordinates: { latitude: number; longitude: number };
  sensors: Array<{
    id: number;
    parameter: { id: number; name: string; units: string };
    latest?: { value: number; datetime: { utc: string } };
    summary?: { max: number; min: number; avg: number };
  }>;
  datetimeLast?: { utc: string };
}

export function parseOpenAQResponse(data: {
  results: OpenAQLocation[];
}): AQIStation[] {
  const stations: AQIStation[] = [];

  for (const loc of data.results ?? []) {
    if (!loc.coordinates) continue;

    // Find the PM2.5 sensor
    const pm25Sensor = loc.sensors?.find(
      (s) => s.parameter?.name === "pm25" || s.parameter?.id === 2
    );

    // Use latest value from sensor, or skip if no data
    const latestValue = pm25Sensor?.latest?.value;
    if (latestValue == null) continue;

    // Convert PM2.5 µg/m³ to AQI using EPA breakpoints
    const aqi = pm25ToAQI(latestValue);

    stations.push({
      id: String(loc.id),
      name: loc.name || `Station ${loc.id}`,
      latitude: loc.coordinates.latitude,
      longitude: loc.coordinates.longitude,
      aqi,
      parameter: "pm25",
      lastUpdated:
        pm25Sensor?.latest?.datetime?.utc ?? loc.datetimeLast?.utc ?? "",
    });
  }

  return stations;
}
