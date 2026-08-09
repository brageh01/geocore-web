import { create } from "zustand";
import type { Viewer } from "cesium";
import type { AQIStation, FireEvent } from "@/lib/contracts";

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
  // The live Cesium viewer, published once it has initialised. Consumers
  // outside the globe subtree — the top bar's camera presets, the impact
  // overlay — need to drive the camera and add entities without GlobeViewer
  // threading a ref down to them. `import type` keeps Cesium out of this
  // module's runtime bundle; only the type is referenced.
  viewer: Viewer | null;
  activeLayers: ActiveLayers;
  // One switch governing the TECHNICAL DATA sections in both the impact
  // briefing and the active-events list, so the two never disagree. Lives in
  // the store rather than component state so it survives fire selection.
  showTechnicalData: boolean;
  timelineDate: Date;
  setSelectedFire: (fire: FireEvent | null) => void;
  setFires: (fires: FireEvent[]) => void;
  setViewer: (viewer: Viewer | null) => void;
  toggleTechnicalData: () => void;
  setAqiStations: (stations: AQIStation[]) => void;
  toggleLayer: (layer: keyof ActiveLayers) => void;
  setTimelineDate: (date: Date) => void;
}

export const useGeocore = create<GeocoreState>((set) => ({
  selectedFire: null,
  fires: [],
  aqiStations: [],
  viewer: null,
  showTechnicalData: false,
  activeLayers: {
    fires: true,
    aqi: true,
  },
  timelineDate: new Date(),
  setSelectedFire: (fire) => set({ selectedFire: fire }),
  setFires: (fires) => set({ fires }),
  setViewer: (viewer) => set({ viewer }),
  toggleTechnicalData: () =>
    set((state) => ({ showTechnicalData: !state.showTechnicalData })),
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
