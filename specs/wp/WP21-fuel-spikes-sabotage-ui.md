# WP21 - Rocket fuel, bumper spikes, sabotage: screens, HUD, visuals

**Wave C2, after WP20 merges.** Presentation of WP20's features. Decisions and rules as in WP20 and `specs/content.md` (sections 2, 3, naming note in section 1).
Read first: `specs/wp/WP20-fuel-spikes-sabotage-core.md`, `specs/content.md` sections 1-3, `specs/design.md` sections 4-5, the WP20 report, then `src/ui/**` (Shop, PreRace, Garage, Hud/Vitals, Controls), `src/game/{index,careerSession}.ts`, `src/render/carMesh.ts` (+ test).
Owns: `src/ui/**`, `src/game/**`, `src/render/carMesh.ts` (+ test). Anything else needs a CCR.
Dispatch: subagent (opus, effort high).

## Deliverables
- Shop UPGRADES: two more lines, **ROCKET FUEL** (5 pips) and **BUMPER SPIKES** (3 pips), same tile style and error handling as the other lines. SUPPLIES: "Rocket fuel" instead of "Turbo".
- Pre-race (career only): one compact row: `SABOTAGE  <NAME>  $<price>` (name from WP20's `sabotageTarget`), below START so START keeps default focus (a stray Enter must not spend cash); confirm buys it (toast "Sabotaged: <NAME> -<pct>%", error toasts "Not enough cash" and, for WP20's `'pending'` reason, "Sabotage already bought for another race"); once bought the row shows the result instead. Hidden in quick race.
- `buySabotage` command wired through careerSession (persist after purchase); the career race setup is rebuilt after a purchase (today it is built in `selectOffer`, before the purchase), or built at `startRace`.
- Renames: HUD turbo bar label `FUEL`; controls screen and KeyHints "Rocket fuel" (KeyHints still says TURBO today); garage supplies "s rocket fuel". Speedo scale `MAX_KMH` 200 -> 360 (rocket fuel 5 + engine 5 on a viper reaches ~341 km/h). No other HUD change (the user dislikes clutter).
- Quick race track picker (user decision 2026-10-25): the quick race pre-race screen gets a TRACK row (left/right) over every track in `TRACKS` with its name and the existing SVG `TrackOutline`; it dispatches `setQuickTrack`, the setup uses the chosen id, and the choice persists as `Settings.quickTrackId` (settings.ts default null = first track, tolerant of unknown ids). `?race=1` ignores it (uses `&track=` or the first track) so gate and soak URLs stay deterministic. Career pre-race keeps showing the offer's track. Career hub shows "New track: <name>" once when `newlyUnlocked` reports one ("New tracks: A, B" for two).
- Behind the results screen the race session stops rendering and updating audio (WP19 found the loop still calls `audio.update` there, which can restart engine sounds after `stopRace`).
- Champion screen: show career `wrecks` and `cashEarned` (CCR-1 fields now exist).
- Car mesh: `spec.spikes` 1/2/3 adds 2/4/6 short open cones `ConeGeometry(r, h, 4, 1, true)` along the front bumper (dark metal, flat shaded); styles that already carry spikes (`boss`) add none. Triangle budget per car rises to < 420 (measured today: max 368 outlaw, +24 for 6 open cones); draw calls per car unchanged (spikes merged into the body geometry). Export `buildSpikesGeometry(spec): BufferGeometry | null` so WP14 can add spikes to imported models. The garage CarPreview passes the player's spikes level (from the save's upgrades) in the mesh spec, so bought spikes show there.

## Acceptance tests
- [ ] Tests never pin the number of tracks (WP22 adds tracks in parallel): derive from TRACKS or inject a list.
- [ ] `npm test`: carMesh spike counts per level and the triangle budget for all 8 roster cars at spikes 3; careerSession sabotage flow (buy, refuse twice, persisted, cleared after the race).
- [ ] Browser (`preview_start` on your `wreckline-wp21` entry, `?autopause=0`): seed a save with enough cash in localStorage first (a fresh career has 600, fuel L1 + spikes L1 cost 800); career -> shop shows ROCKET FUEL and BUMPER SPIKES lines and buys a level of each; pre-race shows the sabotage row, buying it shows the toast; starting the race, the target's snapshot hp equals the sabotaged value; HUD shows `FUEL`; a garage or race screenshot shows bumper spikes on the player car; no console errors.
- [ ] `npm run verify` green.

## Out of scope
Rules and numbers (WP20, WP12), imported car models (WP14 keeps spikes as separate procedural meshes when it lands).
