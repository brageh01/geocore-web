import { NextRequest, NextResponse } from "next/server";
import type { AQIStation } from "@/types";

/**
 * OpenAQ API proxy.
 *
 * Endpoint: GET https://api.openaq.org/v3/locations
 * Auth: X-API-Key header (set OPENAQ_API_KEY in .env.local)
 * Rate limits: 60 requests/minute, 2000/hour on free tier.
 * CORS: Not an issue since we proxy server-side.
 *
 * We fetch locations that measure PM2.5 (parameter_id=2) since it's the
 * most relevant AQI parameter for wildfire smoke impact.
 */

const OPENAQ_BASE = "https://api.openaq.org/v3";

export async function GET(request: NextRequest) {
  const apiKey = process.env.OPENAQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAQ_API_KEY not configured" },
      { status: 500 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const bbox = searchParams.get("bbox") || "-130,24,-65,50"; // Default: continental US
  const limit = Math.min(parseInt(searchParams.get("limit") || "500", 10), 1000);

  // parameter_id=2 is PM2.5 in OpenAQ
  const params = new URLSearchParams({
    limit: String(limit),
    page: "1",
    parameter_id: "2",
    bbox,
  });

  const url = `${OPENAQ_BASE}/locations?${params}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const response = await fetch(url, {
      headers: { "X-API-Key": apiKey },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      console.error("OpenAQ API error:", response.status, text);
      return NextResponse.json(
        { error: `OpenAQ API returned ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    const stations = parseOpenAQResponse(data);

    return NextResponse.json(stations, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        { error: "OpenAQ request timed out after 30 seconds" },
        { status: 504 },
      );
    }
    console.error("OpenAQ proxy error:", err);
    return NextResponse.json(
      { error: "Failed to fetch AQI data from OpenAQ" },
      { status: 502 },
    );
  }
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

function parseOpenAQResponse(data: {
  results: OpenAQLocation[];
}): AQIStation[] {
  const stations: AQIStation[] = [];

  for (const loc of data.results ?? []) {
    if (!loc.coordinates) continue;

    // Find the PM2.5 sensor
    const pm25Sensor = loc.sensors?.find(
      (s) => s.parameter?.name === "pm25" || s.parameter?.id === 2,
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

/**
 * Convert PM2.5 concentration (µg/m³) to AQI using EPA breakpoints.
 * https://www.airnow.gov/aqi/aqi-basics/
 */
function pm25ToAQI(pm25: number): number {
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
        ((iHigh - iLow) / (cHigh - cLow)) * (pm25 - cLow) + iLow,
      );
    }
  }

  return 0;
}
