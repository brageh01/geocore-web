# Recording the demo

Verified 2026-08-09 against dev (`:3000`) and a production build (`:3100`).

## The "1 Issue" badge means you are on :3000

It is the Next.js dev overlay, rendered by a `nextjs-portal` element that
exists only in development. Measured on both ports today: `:3000` has that
element, `:3100` has none, and no other dev-only node renders on either. If you
can see the badge, you are recording the dev server — switch to `:3100`.

Nothing else on screen is dev-only. The only other thing that never belongs in
frame is the browser tab itself, which shows a blank icon because `favicon.ico`
404s.

## Run it

```bash
npm run dev                      # http://localhost:3000
npm run build && PORT=3100 npm start   # http://localhost:3100
```

Both are now equivalent for the demo — the Strict Mode double-init that made
dev unreliable is fixed, and both serve one Cesium viewer. **Record from
`:3100`.** Production has no dev overlay in the DOM at all; dev renders a
`nextjs-portal` element that draws the "N Issue" badge bottom-left.

## Eyeball checklist

Before you hit record:

1. **Opening frame.** Globe centred on the Atlantic, North America left and
   Iberia right, orange detections visible over both. The globe is already
   turning.
2. **It keeps turning** until you touch it — then it stops for good. Zoom,
   drag, a fire click or a preset all end it. It will not creep back.
   `RESET VIEW` is the only way to restart it.
3. **Presets.** `CALIFORNIA` / `BRITISH COLUMBIA` / `IBERIA` each fly ~2.5 s to
   an oblique view with terrain relief, not straight down.
4. **Fire selection.** Click a row in ACTIVE EVENTS or a point on the globe:
   - the camera flies ~2 s and frames the fire *with* all its impact links,
   - glowing arcs grow outward and stagger over ~0.9 s,
   - **every other fire point stays on screen**; the selected one is larger
     with a white outline,
   - a dashed spine labelled `WIND → NE` runs downwind from the fire, and the
     legend gains a compass reading the same bearing,
   - station labels sit on dark plates and stay readable over bright terrain,
   - EVENT DATA leads with a plain-language sentence, then the multiplier.
5. **ACTIVE EVENTS** shows 10 named events — "Washington Complex 1", with an
   intensity word and "air 46.9x dirtier" — never a repeated coordinate. A fire
   selected from the globe that is outside the top 10 is appended and marked.
6. **TECHNICAL DATA** is collapsed by default in both panels. Opening it on one
   opens it on the other; that is one shared control, not a bug. Leave it shut
   unless the script calls for it.
7. **Globe key** sits bottom-left and explains the orange curves.
8. **`RESET VIEW`** clears the panel, flies home, and starts the globe turning
   again.
9. **SIMULATED AQI DATA** chip is visible in the top bar the whole time.

## Known limitations

- **Google Photorealistic 3D Tiles do not load.** Not a referrer problem any
  more — the browser sends the right origin and the key is accepted. Google
  returns 403 with *"satellite tiles and 3D tiles are not available for your
  account and region"* (https://developers.google.com/maps/comms/eea/map-tiles).
  This is account/region level and no code change can work around it. The app
  falls back to the standard Cesium globe, which is what you will be recording.
  Terrain looks soft when zoomed in close as a result — prefer the wider preset
  framings over zooming right in.
- **Attract rotation runs at one revolution per minute.** ~20 s after load the
  camera is over Asia, where the fixture has no data. Start recording promptly,
  or press `RESET VIEW` to get the opening framing back.
- `favicon.ico` 404s. Cosmetic — a blank tab icon, nothing on the page.
- **The `CALIFORNIA` preset frames Nevada, not California.** Its coordinates are
  the centroid of the fixture's "California" bounding box, which reaches to
  114W and so is dominated by Nevada detections; the view it lands on is mostly
  empty desert with the Washington cluster on the horizon. Region *labels* are
  now derived from real coordinates, so fires there correctly read "Nevada" —
  which makes the button name the odd one out. California itself holds only 57
  weak detections in this fixture (largest 12 MW), so re-centring on real
  Californian fires would frame almost nothing. Renaming the button to `NEVADA`
  is the honest one-line fix; say the word.
- All AQI values, station names and impact links are generated. See
  `lib/demo/fakeAQI.ts`.
