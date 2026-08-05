import "server-only";
import { serverConfig } from "@/server/config";
import { UpstreamError } from "@/server/errors";
import type { FireFeature, FireGeoJSON } from "@/lib/contracts";

/**
 * NASA FIRMS active-fire source.
 *
 * Endpoint: https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/VIIRS_SNPP_NRT/{area}/{days}
 *
 * Rate limits: NASA FIRMS allows 10 requests/minute for the free MAP_KEY tier.
 * The MAP_KEY is free but must be requested at https://firms.modaps.eosdis.nasa.gov/api/area/
 * CORS: Not an issue since this only ever runs server-side.
 * API key: Required — set NASA_FIRMS_API_KEY in .env.local
 */

const FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";

export interface FetchFiresOptions {
  /** Bounding box as "west,south,east,north" in degrees. */
  area: string;
  /** Days of history, already clamped by the caller. */
  days: number;
}

export async function fetchFires({
  area,
  days,
}: FetchFiresOptions): Promise<FireGeoJSON> {
  const url = `${FIRMS_BASE}/${serverConfig.nasaFirmsApiKey}/VIIRS_SNPP_NRT/${area}/${days}`;

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    const text = await response.text();
    console.error("FIRMS API error:", response.status, text);
    throw new UpstreamError(
      `FIRMS API returned ${response.status}`,
      response.status
    );
  }

  return parseFirmsCSV(await response.text());
}

export function parseFirmsCSV(csv: string): FireGeoJSON {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const features: FireFeature[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    if (values.length < headers.length) continue;

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j]?.trim() || "";
    }

    const lat = parseFloat(row.latitude);
    const lon = parseFloat(row.longitude);
    if (isNaN(lat) || isNaN(lon)) continue;

    const id = `${row.latitude}_${row.longitude}_${row.acq_date}_${row.acq_time}`;

    features.push({
      type: "Feature",
      id,
      geometry: {
        type: "Point",
        coordinates: [lon, lat],
      },
      properties: {
        brightness: parseFloat(row.bright_ti4) || 0,
        frp: parseFloat(row.frp) || 0,
        acq_date: row.acq_date || "",
        acq_time: row.acq_time || "",
        confidence: row.confidence || "nominal",
        satellite: row.satellite || "N",
        daynight: row.daynight || "D",
      },
    });
  }

  return { type: "FeatureCollection", features };
}
