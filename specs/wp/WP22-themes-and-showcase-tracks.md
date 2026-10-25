# WP22 - Snow, city, quarry themes, new props, three showcase tracks

**Wave C2, after WP20 merges (it applies the CCR-6 types), parallel with WP21.** The user wants about 10 tracks (2026-10-25). Decisions: 3 new themes (snow, city, quarry) plus reuse, visual only (no grip changes), 7 new layouts, career unlocks + quick race picker (WP20/WP21). This WP builds the new looks and one track per new theme; WP23a/b build the other four.
Read first: `specs/content.md` section 12 (track list, constraints, health targets), `specs/design.md` section 1 (new themes, readability rule) and the WP11 track files and report notes in `specs/STATUS.md`, then `src/content/tracks/**`, `src/render/themes/**`, `src/render/props.ts`, `src/render/scene.ts` (applyTheme), `src/shared/trackGeometry.ts` (propRadius, validateTrack), `src/sim/world.ts` (prop colliders), `src/sim/soak.ts`.
Owns: `src/sim/soak.ts` (add `SoakOptions.track?: TrackDef` so unregistered tracks can be soaked, and `SoakStats.wallImpacts` = impact events with `b === 'wall'`, all cars, as in the tuning log), `src/render/themes/**`, `src/render/props.ts`, the `propRadius` table in `src/shared/trackGeometry.ts` and the prop-collider sizes in `src/sim/world.ts` (new kinds only), `src/content/tracks/{frostbite,neonMile,redrock}.ts`, `src/content/tracks/placeProps.ts` (new kinds only), `src/content/tracks/index.ts` (registration lines), `src/content/tracks/m2Tracks.test.ts` (extend). Anything else needs a CCR.
Dispatch: subagent (opus, effort high).

## Deliverables
- Themes `snow`, `city`, `quarry` as ThemeDef data (full token table, hemi, key, fog, optional water) following design.md.
- Props `pine`, `snowbank`, `billboard` (emissive panel, blooms), `crane` (tall static gantry): procedural, flat shaded, one InstancedMesh per kind (billboard may add a second InstancedMesh for its emissive panel, as lightPole does for bulbs), each under 300 triangles; `propRadius` and collider rules (`crane` and `billboard` posts collide like `building`; `pine` and `snowbank` are decoration outside the walls).
- Tracks 4-6 of the content.md list (Frostbite Pass, Neon Mile, Redrock Quarry) with the listed signature, a header comment with the corner list, pickups at tuning-pass-1 density, `referenceLapTime` from the 16-seed soak median.
- Registered in TRACKS in unlock order (after scrapyard, dustBowl, dockside).

## Acceptance tests
- [ ] `npm test`: each new track passes validateTrack, placeProps stable, 10-14 pickups with every kind at least twice; soak 16 seeds per track with WP07 rules; report length, minRadius, wall impacts and wrecks per race per track.
- [ ] Browser (`preview_start` on your `wreckline-wp22` entry, `?race=1&track=<id>&autoplay=1&autopause=0`): one mid-race screenshot per new track at quality high, `drawCalls < 150`, no console errors, no theme fallback warning; the readability rule holds (cars, road edge, pickups, mines visible at a glance).
- [ ] `npm run verify` green.

## Out of scope
Grip or surface rules, the track picker and unlock UI (WP21), the other four tracks (WP23a/b).
