# Geocore Audit

Date of audit: 2026-08-02
Auditor scope: read-only. No source files were modified. `npm install` was run (populates gitignored `node_modules/` and `public/cesium/`) because the repo shipped with no dependencies installed and item 7 is otherwise unrunnable. Working tree verified clean after.

## Repo presence

Only **`geocore-web`** is present at `/Users/bragehogstad/Dev/geocore-web`.

`geocore-services` **does not exist on this machine**. `/Users/bragehogstad/Dev/` contains only `aksjebot`, `geocore-web`, and `ro-ro`. There is no submodule, no sibling checkout, no remote reference to it anywhere in this repo. Section 5 is therefore answered from the *absence* of any calling code in `geocore-web`; the backend itself could not be inspected.

---

## 1. Repo shape

### Directory tree (excluding node_modules, .next, public/cesium build output)

```
geocore-web/
├── .gitignore
├── CLAUDE.md
├── geocore-project-brief.md
├── geocore-web-architecture.md
├── geocore-web-instructions.md
├── package.json
├── package-lock.json
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── api/
│       ├── fires/route.ts
│       └── aqi/route.ts
├── components/
│   ├── globe/
│   │   ├── GlobeViewer.tsx
│   │   ├── FireLayer.tsx
│   │   └── AQILayer.tsx
│   ├── layout/
│   │   └── DashboardShell.tsx
│   └── panels/
│       └── EventCard.tsx
├── hooks/
│   ├── useFireData.ts
│   └── useAQIData.ts
├── lib/
│   └── cesium.ts
├── store/
│   └── useGeocore.ts
└── types/
    └── index.ts
```

25 tracked files. 12 of them are source. That is the entire application.

Files the architecture doc says should exist and **do not**: `app/api/fires/[id]/impact/route.ts`, `components/layout/LeftSidebar.tsx`, `components/layout/RightSidebar.tsx`, `components/layout/TopBar.tsx`, `components/globe/CauseEffectLink.tsx`, `components/panels/ImpactPanel.tsx`, `components/ui/LayerToggle.tsx`, `components/ui/TimelineScrubber.tsx`, `hooks/useCesiumViewer.ts`, `tailwind.config.ts`, `.env.local`, `.env.example`.

### package.json

Name `geocore-web`, version 1.0.0, `"type": "commonjs"`, license ISC, description empty.

Scripts:
```json
"dev":   "next dev --webpack"
"build": "next build --webpack"
"start": "next start"
"lint":  "next lint"
```

`"lint": "next lint"` is **dead**. `next lint` was removed in Next.js 16; the binary now interprets `lint` as a directory argument. See section 7.

Dependencies:

| Package | Version |
|---|---|
| next | ^16.2.1 |
| react | ^19.2.4 |
| react-dom | ^19.2.4 |
| cesium | ^1.139.1 |
| zustand | ^5.0.12 |

Dev: `typescript ^5.9.3`, `tailwindcss ^4.2.2`, `@tailwindcss/postcss ^4.2.2`, `postcss ^8.5.8`, `eslint ^9.39.4`, `eslint-config-next ^16.2.1`, `copy-webpack-plugin ^14.0.0`, `@types/node ^25.5.0`, `@types/react ^19.2.14`, `@types/react-dom ^19.2.3`.

**No `resium`.** Cesium is driven imperatively through `useEffect` and refs. That is a defensible choice, but it means every layer hand-manages its own primitives and listeners, and there is no React-level guarantee against leaks.

`@eslint/eslintrc` is imported by `eslint.config.mjs:3` but is **not declared in package.json**. It resolves transitively today; it is an undeclared dependency and will break if the tree hoists differently.

There is **no `tailwind.config.ts`** despite the architecture doc listing one. Tailwind v4 is configured entirely through `postcss.config.mjs` + the `@import "tailwindcss"` in `app/globals.css`. The design tokens in `globals.css:4-16` are raw CSS custom properties, not Tailwind theme values, so `--fire`, `--aqi-*` etc. are **not usable as Tailwind classes**. Every component hardcodes hex strings instead (`DashboardShell.tsx:26-48`, `EventCard.tsx:23`). The token block is decorative.

### Project docs

No `README.md`. No `INSTRUCTIONS.md`. Three planning docs exist: `geocore-project-brief.md`, `geocore-web-instructions.md`, `geocore-web-architecture.md`.

`geocore-project-brief.md` MVP scope section, verbatim:

> ## MVP Scope
>
> For the first working version, build only:
>
> 1. The 3D globe with Google Photorealistic 3D Tiles via CesiumJS
> 2. Wildfire layer using NASA FIRMS data
> 3. Air quality layer using OpenAQ or AirNow
> 4. The cause-and-effect visual link between a fire and its downstream AQI impact
> 5. Event card panel that opens on clicking a disaster marker
> 6. Timeline scrubber showing at least 7 days of history
>
> **Everything else is V2.** Ship the wildfire + AQI pairing first. It is the most emotionally compelling combination and the most technically tractable to build. Hurricane layer, flood layer, AI briefing, user alerts, view mode filters, thermal rendering — none of that until the MVP is solid.

`geocore-web-instructions.md` MVP scope section, verbatim:

> ## MVP Scope
>
> We are building the MVP first. Do not suggest or build features outside this scope unless explicitly asked.
>
> **In scope for MVP:**
> - 3D globe with Google Photorealistic 3D Tiles rendered via CesiumJS
> - Wildfire layer using NASA FIRMS data
> - Air quality layer using OpenAQ or AirNow
> - Visual cause-and-effect link between a fire event and its downstream AQI impact
> - Event card panel that opens on clicking a disaster marker
> - Timeline scrubber showing at least 7 days of historical data
>
> **V2 and beyond — do not build these yet:**
> Hurricane layer, flood layer, earthquake layer, AI briefing panel, user alerts and notifications, view mode filters (thermal, night vision, smoke opacity), Purple Air hyperlocal layer, Sentinel-5P satellite gas layer.

Of the six MVP items, **2 are built (globe, fire layer), 1 is built but not mounted (AQI layer), 1 is built but shallow (event card), and 2 do not exist at all (cause-and-effect link, timeline scrubber)**.

---

## 2. Git state

**Branch:** `main`, tracking `origin/main`.

**Working tree: clean.** `git status --porcelain` returns nothing. No uncommitted changes, no untracked files.

**Commits — the entire history is 4 commits:**

| Hash | Date | Subject |
|---|---|---|
| `2b8d201` | 2026-04-10 21:10:07 -0500 | feat: Added zoom to a working globe with fires loading per shown surface |
| `3ec4cc0` | 2026-04-10 19:21:44 -0500 | fix: Working fires, with no decreased loading time |
| `67c82fd` | 2026-03-27 16:44:31 -0400 | feature: added working globe with fire layer, layout and layout toogles |
| `12ef83f` | 2026-03-27 15:20:07 -0400 | Added base project overview |

You asked for the last 20. There are only 4.

**Most recent commit:** 2026-04-10. That is **~3 months 23 days ago** (git reports "4 months ago"). The project has been untouched since April.

**Branches:** `main` only, locally and remotely. `remotes/origin/main` is at `2b8d201` — identical to local `main`. No divergence, nothing ahead or behind, no other branches, no stashes, no tags.

`package-lock.json` is committed. `node_modules/` was absent from disk before this audit, meaning this checkout had never been installed (or was cleaned) — the project as handed to me could not run at all without `npm install`.

---

## 3. Feature-by-feature status

### a. Cesium viewer initialisation and lifecycle/cleanup — **PARTIAL**

`lib/cesium.ts:21-86`, `components/globe/GlobeViewer.tsx:9-47`.

Initialisation is real and reasonably careful: widget chrome disabled (`lib/cesium.ts:27-39`), MSAA 4x, credit container detached, camera set to a continental-US overview at 8000 km (`lib/cesium.ts:57-64`), zoom/tilt event types remapped so trackpad pinch zooms instead of tilting (`lib/cesium.ts:79-83`).

Cleanup exists — `GlobeViewer.tsx:30-36` destroys the viewer on unmount and guards with `isDestroyed()`.

The reason this is PARTIAL and not WORKING is a **double-init race under React Strict Mode**. `initViewer` (`GlobeViewer.tsx:15-25`) is `async` and only sets `viewerRef.current` *after* `await initializeViewer(...)` resolves. Next.js enables Strict Mode by default, so in dev the effect at `GlobeViewer.tsx:27-37` mounts, starts the async init, unmounts, and runs cleanup while `viewerRef.current` is still `null` — the cleanup destroys nothing. It then remounts and the `if (... || viewerRef.current) return` guard at line 16 still sees `null`, so it **constructs a second Cesium `Viewer` on the same container**. Both promises resolve; the second overwrites the ref; the first viewer leaks with its WebGL context and its listeners, permanently. NEEDS RUNTIME CHECK to confirm the visible symptom, but the code path is unambiguous. Run `npm run dev`, open the console, and look for two Cesium canvases in the container div or duplicated FIRMS requests.

There is no `hooks/useCesiumViewer.ts`. The ref management the architecture doc assigns to that hook is inlined in `GlobeViewer.tsx`.

### b. Google Photorealistic 3D Tiles — **PARTIAL**

`lib/cesium.ts:42-54`.

```ts
const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
if (googleApiKey) {
  const tileset = await createGooglePhotorealistic3DTileset({ key: googleApiKey });
  viewer.scene.primitives.add(tileset);
}
```

The key path is: `.env.local` → inlined into the client bundle at build time by the `NEXT_PUBLIC_` prefix → passed as `{ key }` to Cesium's `createGooglePhotorealistic3DTileset`, which calls the Google Map Tiles API **directly from the browser**. The code is correct.

It is PARTIAL because **there is no `.env.local` in this checkout**, so `googleApiKey` is `undefined`, the branch is skipped, and you get the bare blue-white Cesium ellipsoid with a `console.warn` (`lib/cesium.ts:51-53`). Photorealistic tiles do not render today on this machine.

Secondary, and more interesting: **fire markers are placed at ellipsoid height 0** (`FireLayer.tsx:156`, `Cartesian3.fromDegrees(lon, lat)` with no height argument) while `lib/cesium.ts:73` sets `depthTestAgainstTerrain = true` and `FireLayer.tsx:164` sets `disableDepthTestDistance: 0`. Google Photorealistic 3D Tiles carry real elevation. Height 0 is *below ground* nearly everywhere on land. Once the Google key is supplied, fires should be **occluded by the terrain they sit on** — buried underground. This almost certainly did not show up during development precisely because the tiles were not loading. NEEDS RUNTIME CHECK: add the key, fly to a fire, see whether the point disappears.

### c. Fallback imagery if Google tiles fail or quota is exceeded — **MISSING**

`lib/cesium.ts:44-49` wraps the tileset load in `try/catch` and `console.error`s the failure. That is all. There is no fallback imagery provider, no Cesium Ion World Imagery fallback, no Bing/OSM layer, no user-visible error state, no quota detection. On failure the user sees the default Cesium ellipsoid with no explanation. The `NEXT_PUBLIC_CESIUM_ION_TOKEN` is set on `Ion.defaultAccessToken` (`lib/cesium.ts:15-18`) but nothing consumes Ion assets, so it is currently inert.

### d. NASA FIRMS data fetching — **WORKING** (code-level), blocked at runtime by missing key

`app/api/fires/route.ts:1-113`.

- Route: `GET /api/fires`, query params `area` (bbox `west,south,east,north`, default `-180,-90,180,90`) and `days` (default `2`, clamped 1–10 at line 36).
- Upstream: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/VIIRS_SNPP_NRT/{area}/{days}` (line 38).
- Auth: `NASA_FIRMS_API_KEY`, server-side, returns 500 if unset (lines 18-25). Correctly never reaches the client.
- CSV parsing: `parseFirmsCSV` at lines 69-113. Splits on `\n`, lowercases headers, naive `split(",")` per row. Rows with fewer fields than headers are skipped (line 80); rows with unparseable lat/lon are skipped (line 89). Maps `bright_ti4`→`brightness`, `frp`→`frp`. Synthesises an id as `lat_lon_date_time` (line 91).
- Caching: `cache: "no-store"` on the upstream fetch (line 41), and `Cache-Control: public, s-maxage=300, stale-while-revalidate=60` on the response (line 57). So there is CDN-edge caching in production but **no server-side or in-memory cache**. Every distinct bbox is a fresh upstream call.

The naive CSV split is acceptable for FIRMS specifically (the feed has no quoted commas), so I am not calling that broken.

**The real problem is rate limiting.** The route's own comment at line 9 states FIRMS allows 10 requests/minute. `FireLayer.tsx:100-110` fires a new bbox request on every `camera.moveEnd` with only a 400 ms debounce. A user panning and zooming around the globe will blow through 10 req/min in seconds. There is no client-side cache, no bbox-quantisation, no request budget, and no 429 handling anywhere — a 429 surfaces as a generic `Failed to fetch fire data: 429` string in `useFireData.ts:43` that **nothing renders**. Fires will silently stop appearing.

### e. Fire markers rendering — **WORKING**

`components/globe/FireLayer.tsx:136-175`.

Fires render into a single GPU-batched `PointPrimitiveCollection` (line 147) rather than one Entity per fire — this is the right call for tens of thousands of points and is the strongest piece of engineering in the repo. Colour and size ramp by FRP (`colorForFrp` lines 39-46, `sizeForFrp` lines 48-55), orange→red per the brief. `NearFarScalar(1_000_000, 1.0, 20_000_000, 0.3)` scales points down at distance (line 151). Previous collection is torn down before rebuild (lines 140-143) and on unmount (lines 169-174), both guarded by `isDestroyed()`.

Caveat: the whole collection is destroyed and rebuilt from scratch on every `fires` change (line 175 dependency), and `fires` changes on every camera move. That is a full re-upload of every point per pan. Works; not cheap.

### f. Fire marker clustering / FRP / confidence threshold filtering — **MISSING**

There is **no clustering of fire markers anywhere**, and **no FRP or confidence threshold filtering anywhere**. `FireLayer.tsx:153-167` adds every feature the API returns, unconditionally. FRP is used only to pick a colour and a pixel size; it never gates rendering. `confidence` is parsed in `app/api/fires/route.ts:105`, carried through to `FireEvent`, displayed in the event card, and used for nothing else.

Clustering logic *does* exist in the codebase — `clusterStations` / `getCellSize` at `AQILayer.tsx:61-98` — but it is in the AQI layer, and that layer is never mounted (see item j). No fire equivalent exists.

The practical effect: at a global viewport, `loadFires()` requests the whole world for 2 days of VIIRS. That is routinely 50k–200k detections, all pushed into a single collection with no thinning. The `MAX_VIEWPORT_LON_SPAN_DEG = 90` guard at `FireLayer.tsx:25` makes this *more* likely, not less — any viewport wider than 90° of longitude deliberately falls back to the global fetch.

### g. Fire click → selection state → event card — **WORKING**

Full path traced:

1. `ScreenSpaceEventHandler` on `viewer.scene.canvas`, bound to `LEFT_CLICK` (`FireLayer.tsx:195-208`), destroyed on unmount (lines 202-207).
2. `handleClick` (`FireLayer.tsx:180-193`) calls `viewer.scene.pick(position)`, reads `picked.id` as a `FirePickId`.
3. The pick id is stashed on each primitive at creation time with the **entire `FireEvent` inline** (`FireLayer.tsx:154`, `165`), so selection is synchronous — no lookup, no fetch.
4. `setSelectedFire(pickId.fire)` writes to Zustand (`FireLayer.tsx:189`, store at `useGeocore.ts:28`).
5. `DashboardShell.tsx:19` reads `selectedFire`; `DashboardShell.tsx:73-84` renders `<EventCard />` when non-null.
6. `EventCard.tsx:6` reads the same field and renders.

This works. There is no deselect-on-empty-click — clicking bare globe does nothing (`FireLayer.tsx:186` early-returns on undefined pick), so the card only closes via the CLOSE button at `EventCard.tsx:26-31`.

### h. Event card contents — **PARTIAL**

`components/panels/EventCard.tsx:35-45`. Exactly eight rows, all raw FIRMS telemetry:

| Label | Source |
|---|---|
| ID | `fire.id` — the synthetic `lat_lon_date_time` string, e.g. `37.1234_-122.5678_2026-04-10_1342`. Meaningless to a human. |
| Location | lat/lon formatted to 4dp with N/S/E/W suffixes (lines 11-18) |
| Brightness | `${frp.toFixed(1)} K` |
| FRP | `${frp.toFixed(1)} MW` |
| Confidence | `fire.confidence` raw. VIIRS emits `l`/`n`/`h` single letters, so this renders as a bare "n". |
| Satellite | `fire.satellite` raw, e.g. "N" |
| Acquired | `${acq_date} ${acq_time}`, e.g. "2026-04-10 1342" — unparsed HHMM, no timezone |
| Day/Night | mapped to "Day"/"Night" (line 44) — the only humanised field |

What the brief asks for and the card does **not** show: event name, severity rating, affected area in km², data source attribution, last-updated timestamp, and — the important one — **any linked environmental consequence metric**. The card is a raw satellite pixel dump, not an intelligence product. There is no `ImpactPanel.tsx`.

### i. OpenAQ / AQI data fetching — **PARTIAL**

`app/api/aqi/route.ts:1-161`.

The route itself is the best-written file in the repo. `GET /api/aqi`, params `bbox` (default `-130,24,-65,50`, continental US) and `limit` (default 500, capped 1000). Hits `https://api.openaq.org/v3/locations?parameter_id=2` with an `X-API-Key` header (lines 40, 48). 30-second `AbortController` timeout with a distinct 504 (lines 43-52, 72-77). Response normalised by `parseOpenAQResponse` (lines 99-132), which finds the PM2.5 sensor, skips stations with no latest value (line 114), and converts µg/m³ to AQI via correct EPA breakpoints including the updated 2024 0–9.0 lower band (`pm25ToAQI`, lines 138-160).

It is PARTIAL for three reasons:

1. **It is orphaned.** The only consumer is `hooks/useAQIData.ts`, whose only consumer is `components/globe/AQILayer.tsx`, which nothing imports. The route is never called by the running application. Verified: `grep -rn "AQILayer"` returns only its own definition.
2. **It does not compile.** `useAQIData.ts:17-18` reads `s.aqiStations` and `s.setAqiStations` from the Zustand store. **Neither field exists** in `GeocoreState` (`store/useGeocore.ts:9-19`). This is the error that fails the production build.
3. **The key name is undocumented.** The route requires `OPENAQ_API_KEY` (line 19). `CLAUDE.md` and `geocore-web-architecture.md` both document `AIRNOW_API_KEY` and never mention `OPENAQ_API_KEY`. Anyone provisioning from the docs sets the wrong variable and gets a 500.

The hardcoded continental-US bbox default is never overridden — `useAQIData.ts:30` fetches bare `/api/aqi` with no params — so AQI would be US-only even if it were mounted.

### j. AQI station markers on the globe — **PARTIAL (dead code)**

`components/globe/AQILayer.tsx:1-215` is a complete, thoughtful implementation: EPA colour scale (lines 29-36), canvas-generated diamond billboard (lines 122-138), zoom-dependent spatial grid clustering picking the worst-AQI station per cell (lines 61-98), a 300-entity cap sorted worst-first (lines 141-158), numeric AQI labels, and correct entity cleanup (lines 204-211).

**It is never rendered.** `GlobeViewer.tsx:7` imports `FireLayer` and only `FireLayer`. `GlobeViewer.tsx:42-44` mounts only `FireLayer`, gated on `activeLayers.fires`. There is no `AQILayer` import and no `activeLayers.aqi` branch anywhere in the component tree. The file is dead on arrival.

Also note `AQILayer.tsx:199` uses `as any` on the entity `properties` object — the only `any` in the codebase.

### k. THE FUSION LOGIC — **MISSING**

This is the item you flagged as most important, so I checked exhaustively. It does not exist in any form.

What I searched for and did not find:
- Any distance function. No haversine, no great-circle, no `Cartesian3.distance`, no `EllipsoidGeodesic` — nothing computes a distance between any two points anywhere in the repo.
- Any spatial proximity join. No radius query, no k-nearest, no bounding-box intersection between fires and stations.
- Any wind or downwind calculation. No wind API, no bearing computation, no plume model, no HRRR-Smoke, no directional weighting. The word "wind" does not appear in any source file.
- Any impact endpoint. `app/api/fires/[id]/impact/route.ts` — documented in `geocore-web-architecture.md` and in `CLAUDE.md` — was never created.
- Any code that reads `selectedFire` and `aqiStations` together. The two datasets never meet in a single scope. `selectedFire` is read by `DashboardShell.tsx:19` and `EventCard.tsx:6`. `aqiStations` does not exist in the store at all.

The only trace of the concept is the type at `types/index.ts:47-51`:

```ts
export interface ImpactLink {
  fireId: string;
  stationId: string;
  distance_km: number;
}
```

`ImpactLink` is **exported and imported by nothing**. It is a three-field declaration of intent with zero implementation behind it. That type is the entire fusion engine.

The product's stated core differentiator — the one thing the brief says no other tool does — is 5 lines of unused TypeScript.

### l. Visual connecting line between fire and stations — **MISSING**

`components/globe/CauseEffectLink.tsx` does not exist. There is no `PolylineCollection`, no `polyline` entity, no `PolylineGlowMaterialProperty`, no arc, no ribbon, no geometry of any kind connecting two points. Nothing in the repo draws a line.

### m. Timeline scrubber — **MISSING (UI), PARTIAL (state stub)**

There is **no timeline UI**. No `TimelineScrubber.tsx`, no `<input type="range">`, no slider, no date picker, no playback control. The top bar (`DashboardShell.tsx:26-50`) contains a wordmark, a subtitle, and two layer buttons. Cesium's own timeline widget is explicitly disabled (`lib/cesium.ts:36`) and CSS-hidden (`globals.css:33-42`).

The state stub exists and is inert: `timelineDate: Date` and `setTimelineDate` at `useGeocore.ts:15`, `18`, `27`, `36`. `setTimelineDate` is **never called by anything**. `timelineDate` is **never read by anything**. It initialises to `new Date()` and stays there for the life of the session.

Nothing is wired to time. `useFireData.loadFires` (`useFireData.ts:28-62`) never sends a `days` param, so `/api/fires` always uses its hardcoded default of 2 days (`app/api/fires/route.ts:33`). The AQI route has no time parameter at all. Even if a slider were added tomorrow, there is no query path behind it. This is a 0%-complete MVP item, not a partially-wired one.

### n. Layer toggles — **PARTIAL**

`DashboardShell.tsx:36-49` renders two `LayerButton`s (component at lines 91-120). Both are visually correct — colour-coded, underlined when active, with a status square.

- **FIRES toggle: works.** `toggleLayer("fires")` → `useGeocore.ts:29-35` → `GlobeViewer.tsx:42` gates `<FireLayer />` on `activeLayers.fires`. Unmounting runs the primitive cleanup at `FireLayer.tsx:169-174`, so points genuinely disappear.
- **AQI toggle: does nothing.** `activeLayers.aqi` is written by `toggleLayer("aqi")` and read by `DashboardShell.tsx:20` for button styling **only**. No layer is gated on it because no AQI layer is mounted. Clicking it changes the button colour and nothing else on the globe.

There is no `components/ui/LayerToggle.tsx`; `LayerButton` is a private function at the bottom of `DashboardShell.tsx`.

### o. Three-column layout and top bar — **WORKING**

`DashboardShell.tsx:23-88`. Flex column, `h-screen w-screen`, `bg-[#0a0a0a]`. Fixed 40px top bar (line 26). Below it a `flex flex-1 min-h-0` row with a 256px left aside (line 55), `flex-1 min-w-0` main holding the globe (line 67), and a 320px right aside (line 72). Correct use of `min-h-0`/`min-w-0`/`shrink-0`, so the Cesium canvas sizes properly. `GlobeViewer` is dynamically imported with `ssr: false` and a loading state (lines 7-16) — correct, Cesium cannot server-render.

Visual direction matches the brief: near-black, monospace, uppercase micro-labels, hairline `#262626` borders, no rounded corners. It looks like the intelligence-workstation aesthetic that was asked for.

The left sidebar is a hardcoded placeholder — `DashboardShell.tsx:54` is literally commented `{/* Left sidebar — event list (placeholder) */}` and lines 60-62 render the static string "Select a fire marker on the globe to view details." **There is no active event list.** The fires array lives inside `FireLayer`'s hook instance and is never lifted to the store, so the left sidebar has no access to it. Filtering by type/severity, per the brief, does not exist. `LeftSidebar.tsx` and `RightSidebar.tsx` were never split out.

---

## 4. State and data flow

### Zustand store — complete shape

`store/useGeocore.ts:9-37`. Six members, no middleware, no persistence, no devtools.

| Field | Type | Written by | Read by |
|---|---|---|---|
| `selectedFire` | `FireEvent \| null` | `FireLayer.tsx:189` (via `setSelectedFire`) | `DashboardShell.tsx:19`, `EventCard.tsx:6` |
| `activeLayers` | `{ fires: boolean; aqi: boolean }` | `toggleLayer` only | `GlobeViewer.tsx:13` (fires only), `DashboardShell.tsx:20` (both, styling only) |
| `timelineDate` | `Date` | **nothing** | **nothing** |
| `setSelectedFire` | `(fire: FireEvent \| null) => void` | — | `FireLayer.tsx:59`, `EventCard.tsx:7` |
| `toggleLayer` | `(layer: "fires" \| "aqi") => void` | — | `DashboardShell.tsx:21` |
| `setTimelineDate` | `(date: Date) => void` | — | **nothing** |

Observations:

- **The store contradicts the documentation.** `CLAUDE.md` and `geocore-web-architecture.md` both specify `selectedFireId`. The implementation stores the whole `FireEvent` inline (with a comment at `useGeocore.ts:10-12` justifying it). The inline choice is actually better for the click path, but the docs were never updated.
- **`aqiStations` / `setAqiStations` do not exist**, yet `hooks/useAQIData.ts:17-18` reads them. This is the build-breaking type error. Someone refactored the store and never touched the AQI hook — or wrote the hook against a store that was planned and never landed.
- **Fire data is not in the store.** `useFireData` holds `fires` in component-local `useState` (`useFireData.ts:24`) inside `FireLayer`. Nothing outside `FireLayer` can see the fire list. This is precisely why the left sidebar is a placeholder and why no fusion is possible: the two datasets have no shared scope.
- One-third of the store (`timelineDate`, `setTimelineDate`) is dead weight.

### API routes

| Route | Method | Input | Output | Upstream |
|---|---|---|---|---|
| `/api/fires` | GET | `area` (bbox `w,s,e,n`, default `-180,-90,180,90`), `days` (default 2, clamped 1–10) | `FireGeoJSON` — `{ type: "FeatureCollection", features: FireFeature[] }` | NASA FIRMS CSV, `VIIRS_SNPP_NRT` |
| `/api/aqi` | GET | `bbox` (default `-130,24,-65,50`), `limit` (default 500, max 1000) | `AQIStation[]` — a bare array, **not** wrapped | OpenAQ v3 `/locations?parameter_id=2` |

Error shapes: both return `{ error: string }`. `/api/fires` → 500 (no key), upstream status passthrough, 502. `/api/aqi` → 500 (no key), upstream passthrough, 504 (timeout), 502.

Inconsistency worth noting: `/api/fires` returns a GeoJSON envelope, `/api/aqi` returns a naked array. Two different response conventions in a two-route API.

Missing: `/api/fires/[id]/impact` — documented in both `CLAUDE.md` and `geocore-web-architecture.md`, never built.

### Normalised internal model

**Yes for shape, no for semantics.** `types/index.ts` defines `FireEvent` (lines 1-18) and `AQIStation` (lines 35-45), and both API routes normalise into them server-side (`app/api/fires/route.ts:93-109`, `app/api/aqi/route.ts:119-128`). Components consume the typed models, not raw upstream JSON. The boundary is drawn in the right place.

But **FIRMS field semantics leak straight through**. `FireEvent` carries `acq_date`, `acq_time`, `daynight`, `satellite`, `brightness`, `confidence` — snake_case FIRMS column names with FIRMS encodings intact. `acq_time` stays a raw `"HHMM"` string; `confidence` stays a raw `"l"`/`"n"`/`"h"`; `daynight` stays `"D"`/`"N"`. `EventCard.tsx:35-45` renders these near-verbatim. `useFireData.ts:48-53` does the GeoJSON→flat conversion with a spread, so the properties object passes through untouched.

So: a normalisation layer exists structurally, but it is a rename-free passthrough of one vendor's CSV schema. There is no `timestamp: Date`, no `confidence: "low" | "nominal" | "high"`, no `source` field, no severity. Swapping VIIRS for MODIS, or adding AirNow alongside OpenAQ, would ripple into the UI.

`ImpactLink` (`types/index.ts:47-51`) is the third model and is entirely unused.

---

## 5. Backend (geocore-services)

**It does not exist here.** Not as a project, not as an empty scaffold, not as a submodule. `/Users/bragehogstad/Dev/` contains `aksjebot`, `geocore-web`, and `ro-ro` — nothing else. I could not inspect Express routes, Redis usage, or any cron/scheduled refresh, because there is nothing to inspect. If a `geocore-services` repo exists elsewhere (another machine, GitHub only), this audit says nothing about it.

**geocore-web is not calling it.** Definitively:

- `SERVICES_BASE_URL` — documented in `CLAUDE.md` and `geocore-web-architecture.md` — appears in **zero** source files. `grep -rn "process\.env"` returns exactly four hits, and it is not among them.
- There is no `/api/v1/...` path anywhere. No versioned endpoint, no client for one.
- Both API routes hit third-party APIs directly: `app/api/fires/route.ts:38` → `firms.modaps.eosdis.nasa.gov`; `app/api/aqi/route.ts:40` → `api.openaq.org`.

So the frontend is still in the "MVP direct-proxy" mode the architecture doc anticipated (`geocore-web-architecture.md`, Notes: *"During MVP, the Next.js API routes call upstream APIs directly"*). That is a legitimate stage — but the two-repo split described throughout the planning docs is, today, a one-repo project. There is no caching tier, no Redis, no scheduled ingestion, and no fusion service. Every user request goes straight to NASA and OpenAQ at their raw rate limits.

---

## 6. Secrets and config

### Every environment variable referenced in code

| Variable | Referenced at | Exposed to browser? | Set here? |
|---|---|---|---|
| `NEXT_PUBLIC_CESIUM_ION_TOKEN` | `lib/cesium.ts:15` | **Yes** | No |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `lib/cesium.ts:42` | **Yes** | No |
| `NASA_FIRMS_API_KEY` | `app/api/fires/route.ts:18` | No — server only | No |
| `OPENAQ_API_KEY` | `app/api/aqi/route.ts:19` | No — server only | No |

That is the complete list. Four variables, two client-exposed.

Documented-but-unreferenced: `SERVICES_BASE_URL` and `AIRNOW_API_KEY` appear in `CLAUDE.md` and `geocore-web-architecture.md` and are used nowhere. Referenced-but-undocumented: `OPENAQ_API_KEY` is required by a live route and appears in **neither** doc. The config documentation is wrong in both directions.

### Keys that leak to the client

Both `NEXT_PUBLIC_` values are inlined into the JS bundle by design and are readable by anyone who opens devtools. That is unavoidable for Cesium Ion and for `createGooglePhotorealistic3DTileset`, which must call Google from the browser.

**The Google Maps key is the real exposure and it is currently unprotected.** There is no referrer restriction in this repo (that is set in Google Cloud Console, so I cannot verify it from here), no API restriction, and no quota alarm. A public `geocore-web` deployed on Vercel with an unrestricted Map Tiles key is a billable liability — Photorealistic 3D Tiles is metered per request and anyone can lift the key from the bundle. **Before this ships publicly, that key must be restricted to your Vercel domain and scoped to the Map Tiles API only.** Same for the Cesium Ion token, though the blast radius is smaller.

The two server-side keys are handled correctly. Neither is `NEXT_PUBLIC_`-prefixed, both are read only inside route handlers, and both return a 500 rather than falling back to anything unsafe when absent.

### Hardcoded secrets

**None.** No key is hardcoded in any source file. I scanned the full commit history (`git log -p --all`) for `AIza…` Google key patterns, JWT prefixes, and `api_key = "…"` assignments: **zero hits**. Nothing was ever committed and later removed. Clean.

### .env files

- **`.env.example` does not exist.** Nothing tells a new contributor — or you, in six months — which four variables to set. Given that two of the four are misdocumented in the markdown files, this is a genuine onboarding trap.
- **`.env.local` does not exist either.** Not gitignored-but-present; genuinely absent from disk. `.gitignore:32` correctly ignores `.env*.local`, so it would be safe if it existed. **This is why nothing loads today.** With no keys, `/api/fires` returns 500, `/api/aqi` returns 500, and the globe renders as a bare ellipsoid. The application in this checkout shows an empty grey globe and nothing else.

---

## 7. Health check

`node_modules/` was **absent** before this audit — the checkout had never been installed. I ran `npm install` (452 packages, 19s) to make items runnable. Working tree verified clean afterwards.

### Type check — **FAILS, 2 errors, 1 file**

`./node_modules/.bin/tsc --noEmit`:

**hooks/useAQIData.ts**
```
hooks/useAQIData.ts(17,40): error TS2339: Property 'aqiStations' does not exist on type 'GeocoreState'.
hooks/useAQIData.ts(18,46): error TS2339: Property 'setAqiStations' does not exist on type 'GeocoreState'.
```

No other file has errors.

### Linter — **BROKEN, cannot run at all**

`npm run lint`:
```
> geocore-web@1.0.0 lint
> next lint

Invalid project directory provided, no such directory: /Users/bragehogstad/Dev/geocore-web/lint
```

`next lint` was removed in Next.js 16. The binary parses `lint` as a positional directory argument. The script has been silently broken since the Next 16 upgrade.

Invoking ESLint directly (`./node_modules/.bin/eslint .`) also fails:
```
Oops! Something went wrong! :(

ESLint: 9.39.4

TypeError: Converting circular structure to JSON
    --> starting at object with constructor 'Object'
    |     property 'configs' -> object with constructor 'Object'
    |     property 'flat' -> object with constructor 'Object'
    |     ...
    |     property 'plugins' -> object with constructor 'Object'
    --- property 'react' closes the circle
Referenced from:
    at JSON.stringify (<anonymous>)
    at .../node_modules/@eslint/eslintrc/lib/shared/config-validator.js:308:45
    at ConfigValidator.formatErrors (.../config-validator.js:299:23)
    at ConfigValidator.validateConfigSchema (.../config-validator.js:330:84)
    at ConfigArrayFactory._normalizeConfigData (.../config-array-factory.js:676:19)
    at ConfigArrayFactory._loadExtendedShareableConfig (.../config-array-factory.js:946:21)
```

`eslint.config.mjs:8-12` wraps `next/core-web-vitals` in `FlatCompat`. With `eslint-config-next` 16 that config is already flat, and round-tripping it through the eslintrc compat shim produces a circular structure the validator cannot serialise. **Nothing in this repo has ever been linted under the current dependency set.** The zero-lint-error state is not a clean bill of health; it is a lint step that has never executed.

### Production build — **FAILS**

`npm run build`:
```
▲ Next.js 16.2.1 (webpack)

  Creating an optimized production build ...
✓ Compiled successfully in 20.6s
  Running TypeScript ...
Failed to type check.

./hooks/useAQIData.ts:17:40
Type error: Property 'aqiStations' does not exist on type 'GeocoreState'.

  15 |   const [loading, setLoading] = useState(true);
  16 |   const [error, setError] = useState<string | null>(null);
> 17 |   const stations = useGeocore((s) => s.aqiStations);
     |                                        ^
  18 |   const setAqiStations = useGeocore((s) => s.setAqiStations);
  19 |   const abortRef = useRef<AbortController | null>(null);

Next.js build worker exited with code: 1 and signal: null
```

Webpack compilation succeeds; the type-check gate fails. **`main` is not deployable.** The last commit on the default branch — the one `origin/main` points at, from April — does not build. Anything pushed to Vercel since then has failed.

Note that the failing file is dead code. The build is blocked by a hook that nothing renders.

---

## 8. Rot

### TODO / FIXME / commented-out blocks

Almost none, which is unusual for a project in this state. Full grep for `todo|fixme|hack|placeholder` across all `.ts`/`.tsx` returns exactly one hit:

- `components/layout/DashboardShell.tsx:54` — `{/* Left sidebar — event list (placeholder) */}`

There are **no commented-out code blocks** anywhere. Comments in the repo are explanatory and genuinely useful (`app/api/fires/route.ts:28-35` on the FIRMS bbox/latency gotchas, `FireLayer.tsx:112-116` on why the initial load is delayed 500ms, `lib/cesium.ts:76-78` on the trackpad zoom fix). Whoever wrote this documented their reasoning well.

The rot here is not commented-out cruft. It is **whole features that were written and then orphaned**.

### Dead files — nothing imports these

| File | Status |
|---|---|
| `components/globe/AQILayer.tsx` | 215 lines. **Imported by nothing.** Contains the only clustering implementation in the repo. |
| `hooks/useAQIData.ts` | 57 lines. Imported only by `AQILayer.tsx`. Transitively dead, and does not compile. |
| `app/api/aqi/route.ts` | 161 lines. Reachable by URL but **never called by the app**. |

That is **433 lines — roughly 40% of the application source — that the running app never touches.** The entire AQI half of the MVP is built, is decent quality, and is disconnected.

### Dead state and types

- `timelineDate` / `setTimelineDate` (`useGeocore.ts:15`, `18`, `27`, `36`) — never read, never called.
- `ImpactLink` (`types/index.ts:47-51`) — never imported.
- `activeLayers.aqi` — written by the toggle, read only for button colour; gates no rendering.
- `NEXT_PUBLIC_CESIUM_ION_TOKEN` — assigned to `Ion.defaultAccessToken` (`lib/cesium.ts:17`) but no Ion asset is ever requested. Inert.
- `useAQIData`'s `loading` / `error` / `refetch` return values (`useAQIData.ts:56`) — no consumer reads them.
- `useFireData`'s `loading` and `error` (`useFireData.ts:71`) — `FireLayer.tsx:58` destructures only `{ fires, loadFires }`. **Fire loading and error states are computed and thrown away.** There is no spinner and no error message anywhere in the UI. A 429 from FIRMS is completely invisible to the user.

### Half-migrated / duplicated / abandoned

1. **The store refactor was left half-done.** `useAQIData.ts` reads `aqiStations`/`setAqiStations`; the store has neither. Either the store was rewritten without updating the hook, or the hook was written against a planned store shape that never landed. This is the build-breaking error, and it has been sitting on `main` since April.
2. **Two competing rendering strategies.** `FireLayer` uses `PointPrimitiveCollection` (GPU-batched primitives); `AQILayer` uses `viewer.entities.add` (the Entity API). Both are valid, but they are different mental models with different cleanup semantics in a two-layer app.
3. **`next lint` was never updated for Next 16**, and the flat-config shim is broken independently. Two separate lint failures stacked on each other.
4. **The architecture doc describes a repo that does not exist.** 12 documented files are missing, including every file related to the two unbuilt MVP features. It reads as a plan that was never revised against reality.
5. **Layer components were never extracted.** `LayerButton` lives inline at `DashboardShell.tsx:91-120` instead of `components/ui/LayerToggle.tsx`; `LeftSidebar`/`RightSidebar`/`TopBar` are inline JSX in the shell.
6. **Undeclared dependency:** `@eslint/eslintrc` is imported by `eslint.config.mjs:3` and absent from `package.json`.
7. **Design tokens defined and unused.** `globals.css:4-16` declares nine CSS custom properties; every component hardcodes hex values instead. `--fire: #FF4500` in CSS, `#FF4500` typed literally at `DashboardShell.tsx:41` and `EventCard.tsx:23`, and a *different* orange ramp (`#FF1A00`…`#FFB347`) at `FireLayer.tsx:41-45`.

---

## 9. Honest read

**What genuinely works end to end today.** With the four environment variables supplied, a user lands on a dark three-column dashboard, sees a photorealistic 3D globe framed on the continental US, pans and zooms with correct trackpad behaviour, watches orange-to-red fire points stream in per viewport as the camera settles, clicks one, and gets a right-hand card with eight fields of raw VIIRS telemetry. The FIRES toggle genuinely removes the layer. That path is real, and the fire rendering in particular — batched point primitives, FRP-driven colour and size ramps, aborting stale requests on rapid camera moves — is properly engineered. Without those variables, which is the state of this checkout, the user sees a bare grey ellipsoid and nothing else, because there is no `.env.local` and no `.env.example` to tell them what is missing. And on `main` as committed, `npm run build` fails, so what is deployed is nothing at all.

**The single biggest thing between this and a click-fire-see-consequence demo: the fusion logic does not exist, and the two datasets it would fuse have never been in the same scope.** This is not a matter of connecting two working halves. `AQILayer` is orphaned, `useAQIData` references store fields that were never created, and the fire list lives in component-local `useState` inside `FireLayer` where nothing else can reach it. There is no distance function, no proximity join, no wind data, no `/api/fires/[id]/impact` route, and no polyline code anywhere in the repo. `ImpactLink` — `fireId`, `stationId`, `distance_km` — is the entire cause-and-effect engine, and nothing imports it. The unblocking sequence is: lift `fires` into the Zustand store, add `aqiStations` to the store so `useAQIData` compiles and the build passes, mount `AQILayer` under the `aqi` toggle, then write the haversine-and-radius join that produces `ImpactLink[]` and the polyline that draws it. Items 1–3 are hours of work. Item 4 is the actual product and has not been started.

**What surprised me.** First: the build has been broken on `main` for four months, and it is broken by dead code — a hook that nothing renders, failing a type check that blocks a compilation which otherwise succeeds in 20 seconds. That is a one-line fix standing between you and a deployable app. Second: the lint step has *never run* in this repo's life under the current dependencies — `next lint` was removed in Next 16, and the flat-config shim throws a circular-JSON error independently. Zero lint errors here means zero lint executions, not clean code. Third, and easiest to forget: about 40% of your source is the AQI half, it is written to a decent standard including the only clustering code you have, and it is completely disconnected — you built more of the MVP than the running app shows. Fourth: `depthTestAgainstTerrain = true` (`lib/cesium.ts:73`) combined with fires placed at ellipsoid height 0 (`FireLayer.tsx:156`) means your fire markers should sink *underneath* Google's photorealistic terrain the moment that key is supplied. You almost certainly never saw it because the tiles were not loading. Fifth: FIRMS allows 10 requests/minute, your camera `moveEnd` handler fires one per 400ms of settled movement, and the resulting 429 is caught into an `error` string that `FireLayer.tsx:58` never destructures — fires will stop appearing with no message. And last: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` ships in the client bundle by necessity, Photorealistic 3D Tiles is metered per request, and this repo is intended to be public. Restrict that key to your Vercel domain and to the Map Tiles API before anything goes live.
