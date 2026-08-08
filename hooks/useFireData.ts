"use client";

import { useState, useCallback, useEffect } from "react";
import type { ApiResponse, FireEvent, FireGeoJSON } from "@/lib/contracts";
import { useGeocore } from "@/store/useGeocore";
import { DEMO_MODE } from "@/lib/demo/flag";
import { DEMO_FIRES } from "@/lib/demo/fires";

interface UseFireDataReturn {
  fires: FireEvent[];
  loading: boolean;
  error: string | null;
  /**
   * Load fires for the given bbox (west,south,east,north in degrees).
   * Pass `undefined` to fetch the global default set.
   * Aborts any in-flight fetch so stale responses can't overwrite fresh ones.
   */
  loadFires: (bbox?: string, days?: number) => Promise<void>;
}

// Matches the server-side default in app/api/fires/route.ts. Part of the cache
// key so a future timeline scrubber can't serve day-2 data for a day-7 request.
const DEFAULT_DAYS = 2;

// How long a fetched bbox stays usable before we go back to FIRMS. FIRMS
// allows 10 requests/minute and VIIRS NRT updates on the order of hours, so a
// 5 minute window costs no freshness worth having and removes almost all
// repeat traffic from panning back and forth over the same ground.
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  events: FireEvent[];
  fetchedAt: number;
}

// Module-scoped so the cache survives FireLayer unmounting (the FIRES toggle)
// and is shared by every hook instance.
const fireCache = new Map<string, CacheEntry>();

// The key of the most recent load. Used to skip the store write entirely when
// the camera settles inside the same quantized cell it was already in.
let lastRequestedKey: string | null = null;

// Module-scoped abort controller. One in-flight fire fetch across the whole
// app — every new call aborts the previous one, so rapid camera moves can
// never stack overlapping requests.
let inFlightController: AbortController | null = null;

function cacheKey(bbox: string | undefined, days: number): string {
  return `${bbox ?? "global"}|${days}`;
}

// Demo mode: a no-op standing in for `loadFires`. Hoisted to module scope so
// its identity is stable forever — `loadFiresForViewport` in FireLayer is a
// useCallback keyed on it, and a fresh closure per render would re-run the
// effect that owns the camera listener.
const noopLoadFires = async () => {};

export function useFireData(): UseFireDataReturn {
  // Fires live in the Zustand store so consumers outside this hook's
  // component (sidebar, fusion logic) can read the same list.
  const fires = useGeocore((s) => s.fires);
  const setFires = useGeocore((s) => s.setFires);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo mode: seed the store from the frozen fixture exactly once, then never
  // touch the network again. No debounce, no cache, no requests — `loadFires`
  // is a no-op, so the camera cannot provoke a fetch no matter how the caller
  // behaves. Guarded on `fires.length` rather than a mount-once ref so React
  // Strict Mode's double effect invocation doesn't matter.
  useEffect(() => {
    if (!DEMO_MODE) return;
    if (fires.length === 0) setFires(DEMO_FIRES);
  }, [fires.length, setFires]);

  const loadFires = useCallback(
    async (bbox?: string, days: number = DEFAULT_DAYS) => {
      const key = cacheKey(bbox, days);
      const cached = fireCache.get(key);
      const isFresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;

      if (isFresh) {
        // Cache hit — no network. Note we hand back the *same array
        // reference* that was cached, so downstream memos and effects keyed on
        // `fires` see an unchanged value and skip their rebuild entirely.
        if (key !== lastRequestedKey) {
          lastRequestedKey = key;
          setFires(cached.events);
        }
        setError(null);
        return;
      }

      // Cache miss or expired entry. Note failures are never cached, so a
      // bbox that 429'd is retried the next time the camera settles on it.
      lastRequestedKey = key;

      inFlightController?.abort();
      const controller = new AbortController();
      inFlightController = controller;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (bbox) params.set("area", bbox);
        if (days !== DEFAULT_DAYS) params.set("days", String(days));
        const qs = params.toString();
        const url = qs ? `/api/fires?${qs}` : "/api/fires";

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Failed to fetch fire data: ${res.status}`);

        const body: ApiResponse<FireGeoJSON> = await res.json();
        if (controller.signal.aborted) return;
        if ("error" in body) throw new Error(body.error);

        const events: FireEvent[] = body.data.features.map((f) => ({
          id: f.id,
          latitude: f.geometry.coordinates[1],
          longitude: f.geometry.coordinates[0],
          ...f.properties,
        }));

        fireCache.set(key, { events, fetchedAt: Date.now() });
        setFires(events);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [setFires]
  );

  useEffect(() => {
    return () => {
      inFlightController?.abort();
      inFlightController = null;
    };
  }, []);

  if (DEMO_MODE) {
    return { fires, loading: false, error: null, loadFires: noopLoadFires };
  }

  return { fires, loading, error, loadFires };
}
