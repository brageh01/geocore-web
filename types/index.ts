export interface FireEvent {
  id: string;
  latitude: number;
  longitude: number;
  brightness: number;
  /** Fire radiative power in MW */
  frp: number;
  /** Acquisition date (ISO string) */
  acq_date: string;
  /** Acquisition time (HHMM) */
  acq_time: string;
  /** Confidence level: "low" | "nominal" | "high" */
  confidence: string;
  /** Satellite source identifier */
  satellite: string;
  /** Day or night pass */
  daynight: string;
}

export interface FireGeoJSON {
  type: "FeatureCollection";
  features: FireFeature[];
}

export interface FireFeature {
  type: "Feature";
  id: string;
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: Omit<FireEvent, "id" | "latitude" | "longitude">;
}

export interface AQIStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  aqi: number;
  /** Primary pollutant */
  parameter: string;
  /** ISO timestamp of last update */
  lastUpdated: string;
}

export interface ImpactLink {
  fireId: string;
  stationId: string;
  distance_km: number;
}
