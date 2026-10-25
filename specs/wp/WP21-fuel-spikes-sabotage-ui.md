# WP21 - Rocket fuel, bumper spikes, sabotage: screens, HUD, visuals

**Wave C2, after WP20 merges.** Presentation of WP20's features. Decisions and rules as in WP20 and `specs/content.md` (sections 2, 3, naming note in section 1).
Read first: `specs/wp/WP20-fuel-spikes-sabotage-core.md`, `specs/content.md` sections 1-3, `specs/design.md` sections 4-5, the WP20 report, then `src/ui/**` (Shop, PreRace, Garage, Hud/Vitals, Controls), `src/game/{index,careerSession}.ts`, `src/render/carMesh.ts` (+ test).
Owns: `src/ui/**`, `src/game/**`, `src/render/carMesh.ts` (+ test). Anything else needs a CCR.
Dispatch: subagent (opus, effort high).

## Deliverables
- Shop UPGRADES: two more lines, **ROCKET FUEL** (5 pips) and **BUMPER SPIKES** (3 pips), same tile style and error handling as the other lines. SUPPLIES: "Rocket fuel" instead of "Turbo".
- Pre-race (career only): one compact row: `SABOTAGE  <NAME>  $<price>`; confirm buys it (toast "Sabotaged: <NAME> -<pct>%", error toast "Not enough cash" / "Already sabotaged"); once bought the row shows the result instead. Hidden in quick race.
- `buySabotage` command wired through careerSession (persist after purchase).
- HUD: the turbo bar label reads `FUEL`; controls screen reads "Rocket fuel". No other HUD change (the user dislikes clutter).
- Behind the results screen the race session stops rendering and updating audio (WP19 found the loop still calls `audio.update` there, which can restart engine sounds after `stopRace`).
- Champion screen: show career `wrecks` and `cashEarned` (CCR-1 fields now exist).
- Car mesh: `spec.spikes` 1/2/3 adds 2/4/6 short cone spikes along the front bumper (dark metal, flat shaded); styles that already carry spikes (`boss`) add none. Triangle budget per car rises to < 420; draw calls per car unchanged (spikes merged into the body geometry).

## Acceptance tests
- [ ] `npm test`: carMesh spike counts per level and the triangle budget for all 8 roster cars at spikes 3; careerSession sabotage flow (buy, refuse twice, persisted, cleared after the race).
- [ ] Browser (`preview_start` on your `wreckline-wp21` entry, `?autopause=0`): career -> shop shows ROCKET FUEL and BUMPER SPIKES lines and buys a level of each; pre-race shows the sabotage row, buying it shows the toast; starting the race, the target's snapshot hp equals the sabotaged value; HUD shows `FUEL`; a garage or race screenshot shows bumper spikes on the player car; no console errors.
- [ ] `npm run verify` green.

## Out of scope
Rules and numbers (WP20, WP12), imported car models (WP14 keeps spikes as separate procedural meshes when it lands).
