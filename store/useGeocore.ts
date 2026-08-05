import { create } from "zustand";
import type { AQIStation, FireEvent } from "@/types";

interface ActiveLayers {
  fires: boolean;
  aqi: boolean;
}

interface GeocoreState {
  // Full selected fire, stored inline so EventCard can render instantly
  // from the click payload without re-fetching or searching a separate
  // fires array.
  selectedFire: FireEvent | null;
  // Fire and AQI datasets live in the store rather than in component-local
  // state so that any consumer (globe layer, sidebar list, future fusion
  // logic) can read the same list without refetching.
  fires: FireEvent[];
  aqiStations: AQIStation[];
  activeLayers: ActiveLayers;
  timelineDate: Date;
  setSelectedFire: (fire: FireEvent | null) => void;
  setFires: (fires: FireEvent[]) => void;
  setAqiStations: (stations: AQIStation[]) => void;
  toggleLayer: (layer: keyof ActiveLayers) => void;
  setTimelineDate: (date: Date) => void;
}

export const useGeocore = create<GeocoreState>((set) => ({
  selectedFire: null,
  fires: [],
  aqiStations: [],
  activeLayers: {
    fires: true,
    aqi: true,
  },
  timelineDate: new Date(),
  setSelectedFire: (fire) => set({ selectedFire: fire }),
  setFires: (fires) => set({ fires }),
  setAqiStations: (stations) => set({ aqiStations: stations }),
  toggleLayer: (layer) =>
    set((state) => ({
      activeLayers: {
        ...state.activeLayers,
        [layer]: !state.activeLayers[layer],
      },
    })),
  setTimelineDate: (date) => set({ timelineDate: date }),
}));
