# WP20 - Rocket fuel, bumper spikes, sabotage: contract, sim, content, career logic

**Wave C2, after WP19 merges (it owns `src/game` until then).** The user asked (2026-10-25) for: **Bumper Spikes** (more ramming damage), **Sabotage** ("pay a mechanic to secretly damage the best opponent of the race, 25% to 49% damage") and **Rocket Fuel** (the current boost, improvable in the market). Decisions (grilled): spikes = upgrade line 0-3; sabotage = 30% of 1st prize, any race incl. boss, target = most points; rocket fuel = strength upgrade 0-5 plus UI rename; rivals get spikes and fuel levels from skill, never sabotage.
This WP does everything below the UI. WP21 then does the screens, HUD rename and spike visuals.
Read first: `specs/contracts.ts` (CCR-5 changes: CarStats turbo/ram fields, CarMeshSpec.spikes, UpgradeKind fuel/spikes, SaveGame v2, RaceOffer.sabotagePrice, GameCommand buySabotage), `specs/content.md` sections 1, 2, 3, 4, 5, 8, 10 (rules marked CCR-5 / 2026-10-25), `specs/wp/WP09-career-logic.md`, then `src/shared/contracts.ts`, `src/content/{cars,economy,vehicle,quickRace}.ts`, `src/sim/{vehicle,combat}.ts` (+ tests), `src/meta/**`.
Owns: `src/shared/contracts.ts` (apply CCR-5 and CCR-6 by copying `specs/contracts.ts` verbatim: authorised for this WP only), `src/content/**` except `src/content/tracks/**` (WP22/WP23 own the tracks), `src/sim/vehicle.ts`, `src/sim/combat.ts` (+ their tests), `src/meta/**`, and compile-only fixes elsewhere that the type change forces (fixtures, Record<UpgradeKind> maps, version literals), each listed in the report, with no behaviour change. Anything else needs a CCR.
Dispatch: subagent (opus, effort high).

## Deliverables
- Contracts copied; the whole tree compiles.
- Content: base `turboSpeedMult` 1.30, `turboAccelMult` 1.60, `ramDealtMult` 1, `ramTakenMult` 1 on every car; `mesh.spikes` 0; upgrade effects and costs for `fuel` and `spikes` with per-kind `MAX_LEVEL`; `computeStats` applies them (additive per level, as content.md section 2 says).
- Sim: turbo modifiers read `eff.turboSpeedMult` / `eff.turboAccelMult` instead of constants; car-vs-car damage applies the front-hit rule of content.md section 5 for each side. Wall and mine damage unchanged.
- Meta: save v2 with a v1 -> v2 migration in `parseSave` (missing upgrade kinds 0, wrecks 0, cashEarned 0, sabotage null, bestRank = the save's current rank; never throws); `bestRank` updates after every race; `unlockedTrackIds(save, trackIds = Object.keys(TRACKS))` per content.md section 11 (3 + floor((20 - bestRank) / 2), max 10, registry order) and `generateOffers` rotates over it; a `newlyUnlocked(before, after)` helper the UI uses for the one-time "New track" message; `wrecks` and `cashEarned` accumulate in `applyRaceResult`; `generateOffers` fills `sabotagePrice`; `buySabotage(save, offer): ShopResult` (cash check, once per offer, target and pct from the meta RNG, stored in `save.sabotage`); `buildCareerRaceSetup` applies a matching sabotage to the target's start hp, sets every entrant's `mesh.spikes` from its spikes level, and gives rivals spikes `floor(skill*3)` and fuel `floor(skill*5)` (boss fuel 5, spikes 3); `applyRaceResult` clears `sabotage`. Shop `buyUpgrade` respects per-kind max; `careerSim` priority becomes repair > engine > armor > tires > gun > fuel > spikes > next car.

## Acceptance tests
- [ ] `npm test`: computeStats at fuel 5 gives turbo 1.50 / 2.00, spikes 3 gives 2.5 / 0.55; spikes level 4 is `max`; costs match content.md for raven and viper.
- [ ] Sim: a 25 m/s front hit by a spikes-3 car deals 2.5x the base damage to the other car and takes 0.55x itself (same scenario as WP02 test 8, cars `ai: null`); a side hit applies no multiplier; turbo at fuel 5 reaches a higher top speed than at fuel 0 by the expected ratio (+-2%).
- [ ] Meta: v1 save fixture migrates to v2 and round-trips; sabotage: price per tier, target = most points (ties higher skill), boss race targets the boss, pct in 25..49 and deterministic per rngState, second purchase for the same offer refused, start hp applied in the setup, cleared after the race; rival spikes/fuel levels; purity test still green.
- [ ] Unlocks: with an injected list of 10 ids, rank 20 -> 3 tracks, rank 18 -> 4, rank 6 -> 10, rank 1 -> 10; offers only use unlocked ids; bestRank never gets worse.
- [ ] CCR-6 types compile: the new TrackTheme and PropKind members exist; renderer and content code that switch on them get a neutral default (WP22 fills them in), listed as compile-only fixes.
- [ ] Soak (16 seeds, WP07 rules) still green on all three current tracks (quick race has no upgrades, so numbers should match the tuning log).
- [ ] `npm run verify` green.

## Out of scope
Any screen, HUD text, car visuals (WP21), economy tuning (WP12), AI using spikes on purpose.
