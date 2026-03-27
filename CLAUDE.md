# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Geocore is a real-time global disaster and environmental intelligence dashboard. It renders live disaster events (wildfires, hurricanes, earthquakes) alongside downstream environmental consequences (air quality, smoke plumes) on a photorealistic 3D globe. The core differentiator is the **cause-and-effect narrative** — showing a wildfire *and* the AQI collapse it causes as a unified view.

Reference aesthetic: Bilawal Sidhu's WorldView ("Google Earth meets Palantir"). Dark, cinematic, professional intelligence workstation — not a consumer weather app.

## Build Commands

```bash
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run lint         # ESLint
```

No test framework is configured yet.

## Tech Stack

- **Framework**: Next.js (App Router) with TypeScript
- **3D Globe**: CesiumJS with Google Photorealistic 3D Tiles
- **Styling**: Tailwind CSS (dark theme, deep black background)
- **State**: Zustand (`store/useGeocore.ts` — selectedFireId, activeLayers, timelineDate)
- **Deployment**: Vercel

## Architecture

**Two-repo split:**
- `geocore-web` (this repo, public) — frontend + API proxies
- `geocore-services` (private) — backend data platform, fusion engine, ingestion pipelines

They communicate via versioned REST endpoints (`/api/v1/...`). Never commit secrets or proprietary logic here.

**Key directories:**
- `app/` — Next.js App Router pages and API route proxies
- `components/layout/` — DashboardShell (3-column), LeftSidebar, RightSidebar, TopBar
- `components/globe/` — GlobeViewer (Cesium lifecycle), FireLayer, AQILayer, CauseEffectLink
- `components/panels/` — EventCard, ImpactPanel
- `hooks/` — One hook per data layer (useFireData, useAQIData, useCesiumViewer). Layers must be independently toggleable.
- `store/` — Zustand global store
- `lib/` — Cesium config and shared helpers
- `types/` — Shared TypeScript types (FireEvent, AQIStation, ImpactLink)

**API routes proxy external APIs server-side** — never call third-party APIs directly from the client:
- `/api/fires` — NASA FIRMS
- `/api/fires/[id]/impact` — cause-and-effect data for a specific fire
- `/api/aqi` — OpenAQ / AirNow

## Environment Variables

Set in `.env.local` (never committed):

```
NEXT_PUBLIC_CESIUM_ION_TOKEN=       # Client-safe (Cesium token)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=    # Client-safe (Google Maps)
SERVICES_BASE_URL=                  # geocore-services backend URL
NASA_FIRMS_API_KEY=                 # Server-side only
AIRNOW_API_KEY=                     # Server-side only
```

`NEXT_PUBLIC_` prefix = exposed to client bundle (non-sensitive only). All other keys are server-side only.

## MVP Scope

Only these features are in scope for MVP:
1. 3D globe with Google Photorealistic 3D Tiles via CesiumJS
2. Wildfire layer (NASA FIRMS)
3. Air quality layer (OpenAQ/AirNow)
4. Cause-and-effect visual link between fire → downstream AQI impact
5. Event card panel on marker click
6. Timeline scrubber (7-day history)

**Do not build V2 features** (hurricane/flood/earthquake layers, AI briefing panel, user alerts, view mode filters, thermal rendering) unless explicitly asked.

## Key Conventions

- **Layer isolation**: Each data layer is self-contained in its own component + hook, independently toggleable
- **Performance matters**: Use `useCallback`/`useMemo` to avoid re-renders. Clean up Cesium entities and event listeners on unmount. Never recreate Cesium entities on every render cycle.
- **Color coding**: Wildfire = orange-red, Smoke = grey-purple gradient, Flood = deep blue, Earthquake = yellow, AQI = EPA scale (green → yellow → orange → red → purple → maroon)
- **Layout**: Three-column (left sidebar: event list | center: full-screen globe | right sidebar: data + AI panel). Top bar holds timeline and toggles.
- `public/cesium/` holds Cesium static worker/asset files copied at build time — do not edit manually
