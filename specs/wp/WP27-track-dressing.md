# WP27 - Track dressing

**User feedback (2026-10-25, verbatim):** "Tracks, I would like them to be more sexy, anything we can do? I want more details on the side". Choices from the grill: all four kinds: kerbs and barriers, ground detail, road surface, ambient life.
Read first: `specs/design.md` (section 1: "Neon scrapyard at dusk", readability first, theme tokens), `specs/content.md` sections 9 and 12-13 (tracks, props), then `src/render/{trackMesh,textures,props,scene}.ts`, `src/render/themes/*.ts`, `src/shared/trackGeometry.ts`, `src/content/tracks/placeProps.ts` (read only).
Owns: `src/render/trackMesh.ts`, `src/render/textures.ts`, `src/render/props.ts`, `src/render/scene.ts`, `src/render/themes/**` (add fields only, never rename or remove one: WP26 reads them), new files `src/render/dressing*.ts` with tests, `docs/tuning-log.md` (append an entry). Not `src/render/{index,carMesh,harness}.ts` (WP14 running) nor `fx`, `camera`, `post`, `particles` (WP26). If the dressing needs wiring in `index.ts`, add it to the group that `trackMesh` already returns; if that is impossible, write a CCR and the brain wires it after WP14 merges.
Dispatch: **session** (art direction the user steers), opus high.

## Hard rule: render only
Dressing is generated in the renderer from the track geometry with a fixed seed per track. No change to `src/content/**`, `src/sim/**`, colliders, props in `TrackDef`, centerlines or widths. Everything new sits on the road surface as paint/texture, on the shoulder without collision, or beyond the wall line. Proof: WP12's probe table (`node scripts/balance/run.mjs`) prints identical numbers before and after.

## What to add (per theme, so each of the 6 themes looks distinct)
- **Kerbs and barriers:** kerbs on every corner entry/exit above a curvature threshold (today only tight corners, 1 m), wider and longer on hairpins; barrier dressing along the walls by theme (tyre walls scrapyard/docks, concrete blocks city, steel rails desert/quarry, snow banks and fences snow).
- **Ground detail:** shoulders and ground with variation instead of flat colour: grass/gravel/sand/snow patches, cracks, puddles (city, docks), drifts (snow), oil stains (scrapyard).
- **Road surface:** asphalt cracks and repair patches, tar seams, worn paint, start/finish line and a start grid, tyre marks baked into the corners.
- **Ambient life:** light pools under lamp poles on the dark themes (scrapyard, docks, snow, city), flags or banners, spectator stands or crowd blobs (instanced, low poly), steam or smoke vents, neon signs (city).

## Readability (design.md section 1, beats looks)
From the race camera (46-62 m up) the player must still tell cars, the road edge, pickups and mines apart at a glance: nothing on or near the road brighter or more saturated than pickups and mine LEDs, edge lines stay visible, no tall dressing between the camera and the road.

## Process with the user
1. Measure the baseline: draw calls and triangles per track at high quality, fps on Scrapyard.
2. Scrapyard first as the reference look: show the user race-height and close-up screenshots before/after, iterate until they say ok.
3. Then the other 5 themes one at a time (Dust Bowl, Dockside, Frostbite, Neon Mile, Redrock), a screenshot set each for the user; the other 4 tracks share those themes, check each once.

## Budgets
- Per track at high quality: at most +30 draw calls over the baseline; race with 4 cars stays under 150 draw calls (WP14's gate). Instance everything repeated.
- Low quality: ambient life off, dressing reduced; report its draw calls too.
- Procedural textures only (canvas, like `textures.ts`), no image files, no new dependency; gzip bundle growth at most 150 kB.
- Texture memory: report the new canvas textures' sizes.

## Acceptance tests
- [ ] WP12 probe table identical before/after (paste both).
- [ ] Unit tests for the dressing generators: deterministic per track (same seed, same output), nothing placed inside the drivable width except paint, nothing inside a wall collider.
- [ ] Per track: before/after draw calls and triangles table; 4-car race under 150 draws; fps as measured.
- [ ] User ok on Scrapyard and on each theme (quote their words in the tuning log).
- [ ] `npm run verify` green; no console errors on all 10 tracks.

## Out of scope
New tracks or layouts, gameplay props, lighting model changes beyond light pools, car effects (WP26).
