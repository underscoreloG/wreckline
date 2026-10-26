# WP31 - Death Rally tight tracks: shape rules, test decoupling, Scrapyard pilot

**User request (2026-10-26), verbatim:** "currently in tracks there are a lot of straight lines, in death rally there are more small turns like in this video https://youtu.be/VhwzqNum3UI?t=900". Then the user chose: rework all 10 tracks, "Death Rally tight" corners, camera unchanged.

Reference read by the brain from the video (around 15:00): north-up top-down camera, the road is almost never straight, a chain of 15-40 m bends left and right with short links between them, laps of about 24 s.

Measured today (brain, 1 m samples, curvature k = |heading change over the next 10 m| / 10 m):

| track | length m | width | near-straight (k < 0.01) | corners (entries k > 0.025) | longest straight m | turning deg/100 m | ref lap s |
|---|---|---|---|---|---|---|---|
| scrapyard | 1049 | 14 | 41% | 10 | 192 | 80 | 27.5 |
| dustBowl | 1419 | 15 | 69% | 2 | 297 | 47 | 35.75 |
| dockside | 1130 | 13 | 58% | 16 | 194 | 81 | 31 |
| frostbite | 1238 | 13 | 74% | 5 | 300 | 59 | 32.5 |
| neonMile | 1409 | 14 | 79% | 7 | 293 | 52 | 38.5 |
| redrock | 1361 | 16 | 49% | 3 | 230 | 53 | 35 |
| junkyardSprint | 834 | 14 | 71% | 6 | 334 | 66 | 23 |
| pineHollow | 1397 | 14 | 75% | 2 | 270 | 36 | 36.5 |
| rainDistrict | 1165 | 14 | 58% | 15 | 206 | 80 | 31.5 |
| blastPit | 1608 | 16 | 90% | 3 | 1148 | 45 | 41.5 |

This WP is the pilot: it sets the rules and redraws Scrapyard only. The other 9 tracks follow in WP32 (three parallel workers, one file set each) after the user plays the pilot, so everything shared must be settled here.

Read first: `SPEC.md`, `specs/contracts.ts` (TrackDef, TrackGeometry), this file, `specs/content.md` sections 6, 7, 12, `src/shared/trackGeometry.ts` (+test), `src/content/tracks/**` (all files and tests), `src/sim/racingLine.ts`, `src/sim/ai.ts` (read only), `src/sim/soak.ts`, `scripts/balance/**`, `docs/tuning-log.md` (WP17, WP12, WP22, WP23 entries).
Owns: `src/shared/trackGeometry.ts` and its test (add the shape metric only, no change to existing behaviour), `src/content/tracks/**`, any `*.test.ts` under `src/` that depends on a track's current shape (only the test files, see Test decoupling), `scripts/balance/**`, `specs/content.md` section 12, `docs/tuning-log.md` (append). Product code in `src/sim`, `src/render`, `src/game`, `src/ui`: read only; a needed change is a CCR in the report.
Dispatch: subagent (opus, effort high). The user plays the pilot before WP32.

## 1. Shape metric and rules (shared by every track from now on)
- Add `trackShape(geometry: TrackGeometry): TrackShape` to `src/shared/trackGeometry.ts`, computed on the uniform samples exactly as the brain measured: k(s) = |wrapped heading(s + 10 m) - heading(s)| / 10 m. Returns `nearStraightShare` (samples with k < 0.01), `corners` (entries into k > 0.025, counted around the closed loop), `longestStraight` (m, longest run of k < 0.01, wrapping), `turnPer100m` (total |heading change| in degrees per 100 m), `minRadius` (m, 1 / max k over a 4 m window). Unit-test it on a circle, a stadium and a square-ish loop with known answers.
- Rules for a Death Rally tight track, checked by a test over every track that opts in (a `shape: 'tight'` marker in the track file or a list in the test, your choice; the 9 old tracks stay out until WP32):
  - `nearStraightShare` <= 0.25
  - `longestStraight` <= 80 m, except the start/finish straight, which may reach 100 m for the 8-car grid
  - `corners` >= 10
  - `turnPer100m` >= 110
  - `minRadius` >= 12 m (the cars are 3.8-5.3 m long, roads 13-16 m wide)
  - `validateTrack` passes (walls never overlap, props outside walls)
  - `referenceLapTime` (0.55 AI median clean lap, same method as today) in 24-32 s
- Write the rules and the metric definition into `specs/content.md` section 12 (a "Track shape (user decision 2026-10-26)" block) so WP32 workers read them from the spec.

## 2. Test decoupling
Today `src/sim/ai.test.ts`, `src/sim/race.test.ts`, `src/sim/vehicle.test.ts`, `src/shared/trackGeometry.test.ts`, `src/content/quickRace.test.ts`, render and theme tests, and the multi-track files `m2Tracks.test.ts`, `wp23a.test.ts`, `wp23b.test.ts` pin today's shapes or mix several tracks in one file.
- Tests that check sim, AI, render or quick race behaviour (not a track's content) must stop depending on a live track's shape: give them a frozen fixture copy of today's Scrapyard (one shared test fixture file under `src/content/tracks/`, for example `fixtures.ts`, not registered in TRACKS) or derive the expectation from the registry. Never weaken what a test checks; say per test what you did.
- Per-track content tests (props, pickups, reference lap, theme props) move to one test file per track (`<trackId>.test.ts`) so WP32's three workers never touch the same file. A registry-wide test (order, count, ids) may stay in one shared file that WP32 will not need to edit.
- `scripts/balance/run.mjs` targets: if they are per track, make each track's target live next to its definition or in a per-track table WP32 can edit without conflicts; report what you chose.

## 3. Scrapyard pilot
Redraw `src/content/tracks/scrapyard.ts` to the rules: same id, name, theme, width 14, a Death Rally feel (constant left/right bends, a hairpin or two, short links, one short start straight). Pickups: 12 (cash 4, mines 3, turbo 3, repair 2), spread along the lap, on the racing line and off it. Props via the existing `placeProps` rules, re-fitted to the new length. Re-measure `referenceLapTime` with the soak method. Report the shape numbers next to the targets.

## Acceptance tests
- [ ] `trackShape` unit tests; the rules test passes for Scrapyard and lists it as the only tight track.
- [ ] All decoupled tests green with unchanged intent; list each moved or re-pointed test.
- [ ] Soak on the new Scrapyard (same seeds as WP12): reference lap in 24-32 s, AI wall impacts and wrecks per race inside the `run.mjs` targets (report before/after), no stuck AI (no timeouts), finished cars cruise fine.
- [ ] `node scripts/balance/run.mjs`: 8/8 inside target (or the honest list of misses, with the cause).
- [ ] Browser (your dev server): a quick race on Scrapyard with `autoplay=1` runs 3 laps with no console errors; screenshots of the minimap/track outline and two race moments (1280x720 canvas captures) into `../wreckline-wt/wp31-shots/`; a top-down outline image of the old and new centerline side by side (any simple render, for the user).
- [ ] `npm run verify` green.

## Out of scope
The other 9 tracks (WP32), camera, AI code, car handling, career economy.
