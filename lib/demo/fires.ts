/**
 * Frozen fire detections for demo mode.
 *
 * `fires.fixture.json` is a one-shot NASA FIRMS VIIRS_SNPP_NRT pull covering
 * California, British Columbia and Iberia. Demo mode reads this instead of
 * `/api/fires` so that no camera movement can ever trigger a network request —
 * a FIRMS round trip mid-pan is what produced the stutter this replaces.
 *
 * The array is module-scoped and frozen at import, so every consumer gets the
 * *same reference* for the life of the page. That matters: `FireLayer` keys its
 * `PointPrimitiveCollection` rebuild on array identity, and a fresh array here
 * would rebuild every point on the GPU for no reason.
 */
import type { FireEvent } from "@/lib/contracts";
import fixture from "./fires.fixture.json";

interface FireFixture {
  fetchedAt: string;
  source: string;
  days: number;
  regions: { name: string; bbox: string; count: number }[];
  count: number;
  fires: FireEvent[];
}

const typedFixture = fixture as FireFixture;

/** Stable reference — never rebuild or re-sort this array in place. */
export const DEMO_FIRES: FireEvent[] = typedFixture.fires;

export const DEMO_FIRES_META = {
  fetchedAt: typedFixture.fetchedAt,
  source: typedFixture.source,
  days: typedFixture.days,
  regions: typedFixture.regions,
};
