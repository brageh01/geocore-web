"use client";

import { useState, useCallback, useEffect } from "react";
import type { ApiResponse, FireEvent, FireGeoJSON } from "@/lib/contracts";
import { useGeocore } from "@/store/useGeocore";

interface UseFireDataReturn {
  fires: FireEvent[];
  loading: boolean;
  error: string | null;
  /**
   * Load fires for the given bbox (west,south,east,north in degrees).
   * Pass `undefined` to fetch the global default set.
   * Aborts any in-flight fetch so stale responses can't overwrite fresh ones.
   */
  loadFires: (bbox?: string) => Promise<void>;
}

// Module-scoped abort controller. One in-flight fire fetch across the whole
// app — every new call aborts the previous one, so rapid camera moves can
// never stack overlapping requests.
let inFlightController: AbortController | null = null;

export function useFireData(): UseFireDataReturn {
  // Fires live in the Zustand store so consumers outside this hook's
  // component (sidebar, fusion logic) can read the same list.
  const fires = useGeocore((s) => s.fires);
  const setFires = useGeocore((s) => s.setFires);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFires = useCallback(async (bbox?: string) => {
    inFlightController?.abort();
    const controller = new AbortController();
    inFlightController = controller;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (bbox) params.set("area", bbox);
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

      setFires(events);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [setFires]);

  useEffect(() => {
    return () => {
      inFlightController?.abort();
      inFlightController = null;
    };
  }, []);

  return { fires, loading, error, loadFires };
}
