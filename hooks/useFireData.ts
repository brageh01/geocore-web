"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { FireEvent, FireGeoJSON } from "@/types";
import { useGeocore } from "@/store/useGeocore";

interface UseFireDataReturn {
  fires: FireEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useFireData(): UseFireDataReturn {
  const [fires, setFires] = useState<FireEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timelineDate = useGeocore((s) => s.timelineDate);
  const abortRef = useRef<AbortController | null>(null);

  const fetchFires = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        date: timelineDate.toISOString().split("T")[0],
      });

      const res = await fetch(`/api/fires?${params}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch fire data: ${res.status}`);
      }

      const geojson: FireGeoJSON = await res.json();

      const events: FireEvent[] = geojson.features.map((f) => ({
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
      setLoading(false);
    }
  }, [timelineDate]);

  useEffect(() => {
    fetchFires();

    return () => {
      abortRef.current?.abort();
    };
  }, [fetchFires]);

  return { fires, loading, error, refetch: fetchFires };
}
