# geocore-web — File Architecture

> This document reflects the intended structure of the `geocore-web` repository.
> It is a living guide, not a contract. Update it when the structure changes meaningfully.
> Coarse-grained by design — top-level directories and key files only.

---

## Root

```
geocore-web/
├── app/                        # Next.js App Router
├── components/                 # All React components
├── hooks/                      # Custom React hooks (one per data layer)
├── store/                      # Zustand state management
├── lib/                        # Shared utilities and config
├── types/                      # Shared TypeScript types
├── public/                     # Static assets including Cesium worker files
├── .env.local                  # Local environment variables — never committed
├── next.config.ts              # Next.js + Cesium webpack config
└── tailwind.config.ts          # Tailwind theme config
```

---

## `app/` — Next.js App Router

```
app/
├── layout.tsx                  # Root layout, fonts, global styles
├── page.tsx                    # Entry point — mounts DashboardShell
└── api/
    ├── fires/
    │   └── route.ts            # Proxies NASA FIRMS data
    ├── fires/
    │   └── [id]/
    │       └── impact/
    │           └── route.ts    # Cause-and-effect data for a specific fire
    └── aqi/
        └── route.ts            # Proxies OpenAQ / AirNow data
```

---

## `components/` — React Components

```
components/
├── layout/
│   ├── DashboardShell.tsx      # Three-column layout wrapper
│   ├── LeftSidebar.tsx         # Active event list panel
│   ├── RightSidebar.tsx        # Data panel and (V2) AI briefing shell
│   └── TopBar.tsx              # Timeline scrubber and layer toggles
├── globe/
│   ├── GlobeViewer.tsx         # CesiumJS viewer init and lifecycle
│   ├── FireLayer.tsx           # NASA FIRMS markers and perimeters
│   ├── AQILayer.tsx            # Air quality station markers
│   └── CauseEffectLink.tsx     # Visual link connecting fire → AQI stations
├── panels/
│   ├── EventCard.tsx           # Detail card shown on marker click
│   └── ImpactPanel.tsx         # AQI consequence data for selected fire
└── ui/
    ├── LayerToggle.tsx         # Layer visibility toggle buttons
    └── TimelineScrubber.tsx    # 7-day history slider
```

---

## `hooks/` — Data Layer Hooks

Each data layer has its own self-contained hook. Layers must be independently toggleable.

```
hooks/
├── useCesiumViewer.ts          # Ref management for the Cesium viewer instance
├── useFireData.ts              # Fetches and manages fire layer data
└── useAQIData.ts               # Fetches and manages AQI layer data
```

---

## `store/` — Zustand State

```
store/
└── useGeocore.ts               # Global store: selectedFireId, activeLayers, timelineDate
```

---

## `lib/` — Utilities and Config

```
lib/
└── cesium.ts                   # Cesium Ion token config and shared globe helpers
```

---

## `types/` — TypeScript Types

```
types/
└── index.ts                    # Shared types: FireEvent, AQIStation, ImpactLink, etc.
```

---

## Environment Variables (`.env.local`)

```
NEXT_PUBLIC_CESIUM_ION_TOKEN=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
SERVICES_BASE_URL=              # geocore-services base URL (empty during MVP if services are not yet split out)
NASA_FIRMS_API_KEY=             # Server-side only — never exposed to client
AIRNOW_API_KEY=                 # Server-side only — never exposed to client
```

---

## Notes

- `NEXT_PUBLIC_` prefix exposes a variable to the client bundle. Only use it for non-sensitive config (Cesium token, Google Maps key).
- NASA FIRMS and AirNow keys must stay server-side — never prefix them with `NEXT_PUBLIC_`.
- The `public/cesium/` directory holds Cesium's static worker and asset files. These are copied in at build time — do not edit manually.
- During MVP, the Next.js API routes call upstream APIs directly. Once `geocore-services` is running, update the routes to proxy through `SERVICES_BASE_URL` instead.
