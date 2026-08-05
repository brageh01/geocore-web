"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AQIStation, ApiResponse } from "@/lib/contracts";
import { useGeocore } from "@/store/useGeocore";

interface UseAQIDataReturn {
  stations: AQIStation[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAQIData(): UseAQIDataReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stations = useGeocore((s) => s.aqiStations);
  const setAqiStations = useGeocore((s) => s.setAqiStations);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAQI = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/aqi", {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch AQI data: ${res.status}`);
      }

      const body: ApiResponse<AQIStation[]> = await res.json();
      if ("error" in body) throw new Error(body.error);

      setAqiStations(body.data);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [setAqiStations]);

  useEffect(() => {
    fetchAQI();

    return () => {
      abortRef.current?.abort();
    };
  }, [fetchAQI]);

  return { stations, loading, error, refetch: fetchAQI };
}
