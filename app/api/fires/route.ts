import { NextRequest, NextResponse } from "next/server";
import type { FireGeoJSON, FireFeature } from "@/types";

/**
 * NASA FIRMS API proxy.
 *
 * Endpoint: https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/VIIRS_SNPP_NRT/{area}/{days}
 *
 * Rate limits: NASA FIRMS allows 10 requests/minute for free MAP_KEY tier.
 * The MAP_KEY is free but must be requested at https://firms.modaps.eosdis.nasa.gov/api/area/
 * CORS: Not an issue since we proxy server-side.
 * API key: Required — set NASA_FIRMS_API_KEY in .env.local
 */

const FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";

export async function GET(request: NextRequest) {
  const apiKey = process.env.NASA_FIRMS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "NASA_FIRMS_API_KEY not configured" },
      { status: 500 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  // FIRMS requires an explicit bbox (west,south,east,north). The "world"
  // shorthand returns 0 rows. Default to the full globe.
  const area = searchParams.get("area") || "-180,-90,180,90";
  // VIIRS NRT data has ~3h ingestion latency, so days=1 is frequently empty
  // depending on time of day. Default to 2 days to guarantee a populated set.
  const days = searchParams.get("days") || "2";

  // Clamp days to max 10 to avoid hitting rate limits
  const clampedDays = Math.min(Math.max(parseInt(days, 10) || 2, 1), 10);

  const url = `${FIRMS_BASE}/${apiKey}/VIIRS_SNPP_NRT/${area}/${clampedDays}`;

  try {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      const text = await response.text();
      console.error("FIRMS API error:", response.status, text);
      return NextResponse.json(
        { error: `FIRMS API returned ${response.status}` },
        { status: response.status }
      );
    }

    const csv = await response.text();
    const geojson = parseFirmsCSV(csv);

    return NextResponse.json(geojson, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("FIRMS proxy error:", err);
    return NextResponse.json(
      { error: "Failed to fetch fire data from NASA FIRMS" },
      { status: 502 }
    );
  }
}

function parseFirmsCSV(csv: string): FireGeoJSON {
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
