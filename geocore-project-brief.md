# Project Brief: Geocore

**A real-time global disaster and environmental intelligence dashboard**

---

## Concept Overview

Geocore is a browser-based, real-time geospatial intelligence platform that fuses live disaster event data with downstream environmental consequence data onto a photorealistic 3D globe.

The core insight: disasters and their environmental aftermath are two layers of the same story. A wildfire is the incident. The air quality collapse across downwind cities is the consequence. No existing public tool shows both together in a unified, visually compelling interface. Geocore does.

The closest reference for aesthetics and ambition is Bilawal Sidhu's WorldView — a viral browser-based geospatial command center described as "what you'd get if Google Earth and Palantir had a baby." Geocore follows the same philosophy: public data, fused intelligently, made visceral through great visual design.

---

## Repository Structure

The project is split into two repositories, reflecting a clean separation between public-facing frontend code and proprietary backend logic.

**`geocore-web` (public)**
The Next.js frontend application. Contains the CesiumJS globe, all UI components, client-side state, and Next.js API routes that proxy public data sources. Designed to be open-source for portfolio, transparency, and community contribution.

**`geocore-services` (private)**
The backend data platform. Contains ingestion pipelines, data normalisation, the cause-and-effect fusion engine, caching, and any proprietary logic. Must remain private. Exposes a versioned REST API consumed exclusively by `geocore-web`.

Never expose secrets, API keys, or proprietary fusion logic in the public repository.

---

## Target Users

- General public during active disasters — the largest audience, drives virality
- Journalists and OSINT researchers covering environmental crises
- Emergency management professionals and first responders
- Insurance and reinsurance companies assessing real-time risk exposure
- Environmental NGOs and policy researchers
- B2B customers in insurance, logistics, and public sector verticals (commercial path)

---

## Core Features

### 1. Photorealistic 3D Globe
A navigable 3D globe using Google's Photorealistic 3D Tiles rendered via CesiumJS — the same API powering Google Earth's volumetric city models. Users zoom from global overview to street level. The globe is the canvas on which all data layers are draped.

### 2. Disaster Event Layer (the Incident)
Live and near-live feeds showing acute disaster events:
- Wildfire perimeters and spread direction (NASA FIRMS)
- Hurricane and tropical storm tracks with forecast cones (NOAA NHC)
- Earthquake events with magnitude and depth (USGS Earthquake Hazards Program)
- Flood gauge readings and inundation zones (USGS Water Services)
- Active volcano alerts and ash cloud projections (Smithsonian GVP / VAAC)

### 3. Environmental Consequence Layer (the Aftermath)
Downstream environmental data showing what the disaster is doing to the surrounding environment:
- Real-time air quality index by location (OpenAQ, AirNow, Purple Air)
- Wildfire smoke plume tracking and PM2.5 concentration maps (NOAA HRRR-Smoke)
- Carbon monoxide and nitrogen dioxide satellite readings (Copernicus / Sentinel-5P)
- UV index and ozone data

### 4. Cause-and-Effect Narrative View
**The key differentiator.** When a user clicks on an active wildfire, the interface draws a visual connection to the downstream air quality degradation it is causing — the smoke plume, the AQI spike in affected cities, the projected path over the next 24–48 hours. This cause-and-effect linking is what no existing tool does. It is the emotional and intellectual core of the product.

### 5. Timeline Scrubber / Playback Mode
A horizontal timeline slider allowing users to scrub backward through recent history (up to 30 days) and watch how a disaster evolved and how environmental conditions changed in response. Makes the product useful for journalists reconstructing events and researchers analysing patterns — not just people watching live.

### 6. View Modes / Visual Filters
Multiple rendering modes for the globe: standard satellite, night vision overlay, thermal/FLIR-style heat rendering, smoke opacity mode, AQI heatmap mode.

### 7. Alert and Notification System
Users drop a pin on any location and receive alerts when a disaster event or AQI threshold breach occurs within a defined radius. The core retention mechanic that turns a viral demo into a product people return to.

### 8. AI Situation Briefing
A sidebar panel for natural language questions about what the user is seeing. "What caused the AQI spike in Sacramento?" or "How far is this hurricane from Miami?" The AI synthesises the live data layers visible on screen and responds with a plain-language briefing. Built on the Anthropic API.

### 9. Event Cards and Data Panel
Clicking any event marker opens a structured data card: event name, start time, severity rating, affected area in km², data source, last updated timestamp, and linked environmental consequence metrics. Minimal, precise UI — designed to feel like a professional intelligence tool.

---

## Tech Stack

| Concern | Tool |
|---|---|
| Frontend framework | Next.js (React) |
| 3D globe rendering | CesiumJS |
| Globe surface | Google Photorealistic 3D Tiles API |
| Styling | Tailwind CSS |
| State management | Zustand |
| Data proxying | Next.js API routes (`geocore-web`) |
| Backend / data platform | Node.js + Express (`geocore-services`) |
| AI briefing panel | Anthropic API (Claude) |
| Deployment | Vercel |

---

## Data Sources

| Layer | Source |
|---|---|
| Wildfire perimeters and FRP | NASA FIRMS |
| Hurricane tracks | NOAA National Hurricane Center |
| Earthquake events | USGS Earthquake Hazards Program API |
| Flood gauge readings | USGS Water Services API |
| Global air quality | OpenAQ API |
| US air quality | AirNow API (EPA) |
| Hyperlocal PM2.5 | Purple Air API |
| Smoke plume forecasting | NOAA HRRR-Smoke model |
| Satellite gas readings | Copernicus / Sentinel-5P |

---

## UI and Design Direction

Dark interface. The globe sits against a deep black background. Data layers use high-contrast colour coding: fire in orange-red, smoke in grey-purple gradient, flood zones in deep blue, earthquake markers in yellow, air quality using the standard EPA AQI scale (green through maroon).

The aesthetic is cinematic and precise — a professional intelligence workstation, not a consumer weather app. Less weather app, more geospatial command centre. Reference: WorldView's "spy telescope" visual language.

**Three-column layout:**
- Left sidebar: active event list, filterable by disaster type and severity
- Centre: full-screen 3D globe
- Right sidebar: selected event data panel and AI briefing panel

A top bar holds the timeline scrubber, view mode toggles, and layer visibility controls.

---

## The Differentiator

> Every other tool shows you either the disaster or the air quality. Geocore shows you the disaster *causing* the air quality collapse — in real time, on a single 3D map.

---

## Commercial Path

**Free tier** — Public access to the live globe with core disaster and AQI layers. Drives virality and builds the user base.

**Pro tier (~$9–15/month)** — Location alerts, 30-day historical playback, downloadable event reports, higher data refresh rates.

**Enterprise tier (custom pricing)** — API access to the fused data layer, white-label deployment, dedicated support. Target customers: insurance companies, reinsurance firms, emergency management agencies, environmental consultancies.

---

## Launch Strategy

Build the MVP. Launch publicly the moment a major disaster is actively unfolding — wildfire season, hurricane season, or a significant earthquake. Post a demo video on X/Twitter and LinkedIn showing the cause-and-effect narrative view during a live event.

This is exactly how WorldView went viral: it launched during an active geopolitical crisis and the timing made it feel essential.

---

## MVP Scope

For the first working version, build only:

1. The 3D globe with Google Photorealistic 3D Tiles via CesiumJS
2. Wildfire layer using NASA FIRMS data
3. Air quality layer using OpenAQ or AirNow
4. The cause-and-effect visual link between a fire and its downstream AQI impact
5. Event card panel that opens on clicking a disaster marker
6. Timeline scrubber showing at least 7 days of history

**Everything else is V2.** Ship the wildfire + AQI pairing first. It is the most emotionally compelling combination and the most technically tractable to build. Hurricane layer, flood layer, AI briefing, user alerts, view mode filters, thermal rendering — none of that until the MVP is solid.
