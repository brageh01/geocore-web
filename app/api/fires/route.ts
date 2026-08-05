import { NextRequest, NextResponse } from "next/server";
import { fetchFires } from "@/server/sources/firms";
import { MissingEnvError, UpstreamError } from "@/server/errors";
import type { ApiResponse, FireGeoJSON } from "@/lib/contracts";

/**
 * GET /api/fires — NASA FIRMS proxy.
 *
 * Query params:
 *   area  bbox "west,south,east,north" in degrees. FIRMS requires an explicit
 *         bbox; the "world" shorthand returns 0 rows, so we default to the
 *         full globe.
 *   days  1–10, default 2. VIIRS NRT has ~3h ingestion latency, so days=1 is
 *         frequently empty depending on time of day.
 */

const DEFAULT_AREA = "-180,-90,180,90";
const DEFAULT_DAYS = 2;
const MIN_DAYS = 1;
const MAX_DAYS = 10;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const area = searchParams.get("area") || DEFAULT_AREA;
  const days = Math.min(
    Math.max(
      parseInt(searchParams.get("days") || String(DEFAULT_DAYS), 10) ||
        DEFAULT_DAYS,
      MIN_DAYS
    ),
    MAX_DAYS
  );

  try {
    const data = await fetchFires({ area, days });
    return NextResponse.json<ApiResponse<FireGeoJSON>>(
      { data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    if (err instanceof MissingEnvError) {
      return NextResponse.json<ApiResponse<FireGeoJSON>>(
        { error: `${err.variable} not configured` },
        { status: 500 }
      );
    }
    if (err instanceof UpstreamError) {
      return NextResponse.json<ApiResponse<FireGeoJSON>>(
        { error: err.message },
        { status: err.status }
      );
    }
    console.error("FIRMS proxy error:", err);
    return NextResponse.json<ApiResponse<FireGeoJSON>>(
      { error: "Failed to fetch fire data from NASA FIRMS" },
      { status: 502 }
    );
  }
}
