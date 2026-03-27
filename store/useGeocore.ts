import { create } from "zustand";

interface ActiveLayers {
  fires: boolean;
  aqi: boolean;
}

interface GeocoreState {
  selectedFireId: string | null;
  activeLayers: ActiveLayers;
  timelineDate: Date;
  setSelectedFireId: (id: string | null) => void;
  toggleLayer: (layer: keyof ActiveLayers) => void;
  setTimelineDate: (date: Date) => void;
}

export const useGeocore = create<GeocoreState>((set) => ({
  selectedFireId: null,
  activeLayers: {
    fires: true,
    aqi: true,
  },
  timelineDate: new Date(),
  setSelectedFireId: (id) => set({ selectedFireId: id }),
  toggleLayer: (layer) =>
    set((state) => ({
      activeLayers: {
        ...state.activeLayers,
        [layer]: !state.activeLayers[layer],
      },
    })),
  setTimelineDate: (date) => set({ timelineDate: date }),
}));
