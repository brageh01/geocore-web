import { create } from "zustand";
import type { FireEvent } from "@/types";

interface ActiveLayers {
  fires: boolean;
  aqi: boolean;
}

interface GeocoreState {
  // Full selected fire, stored inline so EventCard can render instantly
  // from the click payload without re-fetching or searching a separate
  // fires array.
  selectedFire: FireEvent | null;
  activeLayers: ActiveLayers;
  timelineDate: Date;
  setSelectedFire: (fire: FireEvent | null) => void;
  toggleLayer: (layer: keyof ActiveLayers) => void;
  setTimelineDate: (date: Date) => void;
}

export const useGeocore = create<GeocoreState>((set) => ({
  selectedFire: null,
  activeLayers: {
    fires: true,
    aqi: true,
  },
  timelineDate: new Date(),
  setSelectedFire: (fire) => set({ selectedFire: fire }),
  toggleLayer: (layer) =>
    set((state) => ({
      activeLayers: {
        ...state.activeLayers,
        [layer]: !state.activeLayers[layer],
      },
    })),
  setTimelineDate: (date) => set({ timelineDate: date }),
}));
