# WP11 - Tracks 2-3 and themes

Goal: two new tracks with their own look: "Dust Bowl" (desert) and "Dockside" (docks), validated, raced cleanly by the AI, rendered with their themes.
Read first: `SPEC.md`, `specs/contracts.ts` (TrackDef), `specs/content.md` section 12, `specs/design.md` section 1 (palette and lighting format), WP03 report (`applyTheme`, prop builders).
Depends on: M1 gate passed, WP03 merged. Parallel with WP09.
Owns: `src/content/tracks/dustBowl.ts`, `src/content/tracks/dockside.ts`, `src/content/tracks/m2Tracks.test.ts`, `src/render/themes/**` (WP03 created `themes/index.ts` with `ThemeDef`, `THEMES` and scrapyard; you add to it). Registering the tracks in `src/content/tracks/index.ts` is a one-line edit allowed and listed in the report.

## Deliverables
- Two `TrackDef`s meeting the content.md section 12 constraints, each with pickups and prop rules through `placeProps`.
  - **Dust Bowl:** fast, open, long sweepers and one long straight (>= 200 m), a tight hairpin at the far end; props: rocks, cacti, wrecks, tire stacks; no containers. Width 15.
  - **Dockside:** technical, 90-degree corners between container stacks, a chicane, the straight runs along the water edge (the docks theme's `water` half-plane, design.md section 1, placed to match this layout: water beyond the outer wall of that straight); props: containers (as walls of the city), crates, barrels, cones, light poles. Width 13.
- `src/render/themes/desert.ts`, `docks.ts`, registered in WP03's `themes/index.ts` `THEMES` (data only: WP03's `applyTheme` reads it, scene code stays WP03's). Each theme: the full palette token table of design.md section 1 with its own values, hemisphere/key light colors and direction, fog color/density. Desert = late golden hour, warm and bright (key light `#FFD9A0` 2.0, fog `#C9A27A` 0.004). Docks = night with cold blue ambient and orange sodium lamps (key `#9FB4FF` 0.8, more light poles).
- A design note per track (in the file header comment): the corner list in order with s ranges and the intended challenge.

## Acceptance tests
- [ ] `npm test -- m2Tracks` (your `src/content/tracks/m2Tracks.test.ts`) -> both tracks pass `validateTrack` (report length, minRadius, minClearance), `placeProps` output stable.
- [ ] AI soak in the same test file via WP07's `runSoak({ trackId, seed })` from `src/sim/soak.ts`, `it.each` over 16 seeds per track, all finishing rules of WP07 test 2 hold on both tracks; report the median lap of the 0.55 AI as `referenceLapTime`.
- [ ] `?race=1&track=dustBowl&autoplay=1` and `track=dockside` in the browser pane: screenshots mid-race at quality high, `drawCalls < 150` (`__game.session()` stats).

## Allowed deferrals
None.

## Out of scope
New prop kinds (use the existing ones), track editor, weather, day/night cycle.
