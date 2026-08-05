import { NextRequest, NextResponse } from "next/server";
import { fetchAQIStations } from "@/server/sources/openaq";
import { MissingEnvError, UpstreamError } from "@/server/errors";
import type { AQIStation, ApiResponse } from "@/lib/contracts";

/**
 * GET /api/aqi — OpenAQ proxy.
 *
 * Query params:
 *   bbox   "west,south,east,north" in degrees, default continental US.
 *   limit  max stations, default 500, capped at 1000.
 */

const DEFAULT_BBOX = "-130,24,-65,50";
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const bbox = searchParams.get("bbox") || DEFAULT_BBOX;
  const limit = Math.min(
    parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10),
    MAX_LIMIT
  );

  try {
    const data = await fetchAQIStations({ bbox, limit });
    return NextResponse.json<ApiResponse<AQIStation[]>>(
      { data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    if (err instanceof MissingEnvError) {
      return NextResponse.json<ApiResponse<AQIStation[]>>(
        { error: `${err.variable} not configured` },
        { status: 500 }
      );
    }
    if (err instanceof UpstreamError) {
      return NextResponse.json<ApiResponse<AQIStation[]>>(
        { error: err.message },
        { status: err.status }
      );
    }
    console.error("OpenAQ proxy error:", err);
    return NextResponse.json<ApiResponse<AQIStation[]>>(
      { error: "Failed to fetch AQI data from OpenAQ" },
      { status: 502 }
    );
  }
}
