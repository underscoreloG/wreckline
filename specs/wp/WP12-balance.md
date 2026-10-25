# WP12 - Balance and polish

Goal: the numbers in `src/content/**` hit the health metrics below, measured by headless probes, with every change logged.
Read first: `SPEC.md`, `specs/content.md` (all), the reports of WP07, WP09, WP11, and the user's M1 playtest notes (quoted verbatim in the brief by the orchestrator).
Depends on: WP09-WP11 and WP20-WP23 merged (all 10 tracks, fuel, spikes, sabotage).
Owns: values in `src/content/**` (no structural changes), `scripts/balance/**`, `docs/tuning-log.md`, the AI scale constants at the top of `src/sim/ai.ts`, and the **expected values only** in tests that assert tuning numbers (`src/sim/vehicle.test.ts`, `src/sim/race.test.ts`, `src/sim/combat.test.ts`, `src/sim/ai.test.ts`, `src/meta/*.test.ts`, `src/content/**/*.test.ts`): when a retune moves a number a test pins, update that expectation in the same commit and log it. Test logic stays as is. Also owns (CCR-2): the named career constants where they live, `RIVAL_LOADOUT` and the offer-bracket constants (`EASY_FALLBACK_BOTTOM`, `MEDIUM_RANK_WINDOW`, `HARD_TOP_RANKS`, `BOSS_TOP_RANKS`) in `src/meta/career.ts`, `OFF_SIM_*` and `SKILL_WEIGHT_K` in `src/meta/offSim.ts`; and all of `src/meta/careerSim.ts` (a probe model the game does not import). Anything else needs a CCR.
Dispatch: **session** (feel tuning needs the user's live steering).

## Health metrics (targets)

| Metric | Target | Probe |
|---|---|---|
| Career length to champion, `greedy` policy | 18-35 races, champion in >= 14 of 16 seeds | `scripts/balance/career.ts` (vitest probe in the scratchpad pattern: plain `.mjs` config with `root` = project) |
| Career length, `safe` policy | champion in 25-50 races or not at all within 60 | same |
| Wrecks per AI race | 0.2-2.0 (WP07 gate; 0.4-1.5 preferred) | `scripts/balance/races.ts`, 16 seeds x all 10 tracks |
| Gun damage share of all damage | 45-65% | same |
| Mine hits per race | 0.8-3 | same |
| AI finish spread | 0.75 skill car beats 0.35 by >= 0.8 avg places on every track | same |
| Lap time | `referenceLapTime` = median 0.55 AI clean lap per track (+-1 s) | same |
| Cash after race 5, greedy | enough for at least engine 1 + armor 1 + full repair | career probe |

Use 16 seeds minimum (8 is too noisy for averages, the football project measured about +-0.5 on a similar metric).

## Carry-over from earlier WPs
- Career far too long (WP09): `greedy` champion in 2/16 seeds by race 93-99, 0/16 within 60. All 19 rivals score every race off-screen (~6 pts/race in hard) and the player stalls at rank 3-5. This is the main target.
- `playerSkill` in `careerSim.ts` ignores Rocket Fuel and Bumper Spikes levels (WP20): make the model count them before trusting any career number.
- Rivals get spikes floor(skill*3) and fuel floor(skill*5) (content.md): measure their effect on wrecks and finish spread; WP20's probe saw wrecks 0.25 -> 0.56 and walls 2.94 -> 3.81 with fuel 4 / spikes 2.
- At a fresh career (player rank 20) the medium offer draws the same 3 rivals as easy (WP10). Fix with the bracket constants if they can; if it needs logic, write a CCR.
- Frostbite (-0.24 s) and Junkyard Sprint (-0.21 s) `referenceLapTime` medians sit at the edge of the tolerance after WP24 (CCR-7, v0.5.1): re-measure every track on the post-WP24 AI. Neon Mile's reference rests on 12 clean laps (shaky).
- Start position swings walls/wrecks 2x (WP22): use 4-8 starts per track.

## Process
1. Write the probes, run baseline, record it in `docs/tuning-log.md` (date, metric table).
2. Change one group of values at a time (economy, weapons, AI), re-run, log before/after and why.
3. Apply the user's playtest notes first; quote each one in the log and the change it caused.
4. Stop when all metrics are inside targets. If two metrics fight (e.g. more combat makes careers longer), report the trade-off and the chosen compromise instead of looping.

## Acceptance tests
- [ ] `node scripts/balance/run.mjs` prints the metric table with every row inside its target.
- [ ] `npm run verify` green (content tests updated to the new values where they assert numbers).
- [ ] `docs/tuning-log.md` lists every changed value with before/after/why.

## Allowed deferrals
Metrics that conflict, documented with the compromise.

## Out of scope
New mechanics, new content, code structure changes.
