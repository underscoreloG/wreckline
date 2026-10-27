# WP37 - AI pace: competitive with a good human in the same car

**User request (2026-10-27), verbatim:** "I would love the ai to be a little bit more challenging, with the same car, they feel kind of slow. It needs to be competitive without making it too hard and make grinds for hours". Then the user chose: "Top AI matches you" (best AI in a race laps at your pace; mid AI about 3% slower, weakest about 7% slower), and gave their own best lap: **about 23-24 s on Scrapyard, quick race, RAVEN** (the 0.55 AI laps 26.09 s there today).

**Brain diagnosis:** the AI takes bends at `cornerSpeedFactor` 0.78-0.97 of its line speed (`src/sim/ai.ts` line ~398, `src/content/ai.ts` anchors). Since all 10 tracks went Death Rally tight (WP31/WP32, v0.9.0), corners are 75%+ of a lap, so that handicap now costs the AI several seconds a lap. A good human is about 10% faster than the 0.55 AI on Scrapyard (23.5 vs 26.09 s).

**Why the career should not get longer:** the career model (`src/meta/careerSim.ts`) already treats the player as a skill 0.75 driver (`PLAYER_DRIVER_SKILL`) in the same skill space as the rivals. Today a real good human is far better than a real 0.75 AI, so real careers are easier than the model says. After this WP a good human drives like the new 0.75 AI, so the model becomes true and the "champion in 18-35 races" target keeps meaning what it says. Do not change the economy unless a check below fails.

Read first: `SPEC.md`, `specs/content.md` sections 8 (AI profiles) and 12 (track shape rules, referenceLapTime), `src/content/ai.ts`, `src/sim/ai.ts` (speed target, braking, line), `src/sim/soak.ts`, `src/meta/careerSim.ts`, `scripts/balance/**`, `docs/tuning-log.md` (WP12, WP34 entries).
Owns: `src/content/ai.ts`, `src/sim/ai.ts` (+test), `src/sim/soak.ts` (only if the calibration needs it), the `referenceLapTime` line (and its comment) in each of the 10 `src/content/tracks/<id>.ts` files and the matching numbers in their test files, the `referenceLapTime` range in `src/content/tracks/shape.test.ts`, `scripts/balance/**`, `src/meta/careerSim.ts` (only if a check fails, say why), `specs/content.md` sections 8 and 12 (the numbers you change), `docs/tuning-log.md` (append). Read only: car stats, weapons, economy, track layouts.
Dispatch: subagent (opus, effort high). Branch `wp/37-ai-pace`, worktree `../wreckline-wt/wp37`. No browser screenshots needed; one quick race with no console errors is enough.

## 1. Pace target
Let **P** = the good-human pace = 0.90 x today's 0.55 AI median clean lap on each track (Scrapyard: 23.5 s). Same car (RAVEN, stock), clean laps, the soak method. Target median clean lap by skill:

| skill | who | target lap |
|---|---|---|
| 0.0-0.1 | weakest career rivals | about P x 1.10 |
| 0.35 | quick race weakest | P x 1.07 (+-1%) |
| 0.55 | quick race mid, autoplay | P x 1.03 (+-1%) |
| 0.75 | quick race top, `PLAYER_DRIVER_SKILL` | P x 1.00 (+-1%) |
| 1.0 | top career rivals | about P x 0.98 |
| 1.1 | THE WARDEN | about P x 0.97 |

- Measure on at least Scrapyard, Neon Mile (right angles), Dust Bowl (open) and Frostbite (switchbacks); report all 10 tracks for 0.35/0.55/0.75.
- Knobs, in order: `cornerSpeedFactor` anchors; the AI's braking point and line (if even factor 1.0 cannot reach P x 0.97, the AI is leaving pace elsewhere: find where and fix it in `src/sim/ai.ts`); `lineNoise` / `reactionTicks` for the spread between skills. Never give the AI grip, power or top speed beyond its car's stats, and never make rubber banding stronger (hard and boss stay at 0).
- Report the probe trail (each candidate: per-skill lap ratios on the 4 tracks).

## 2. Keep everything else in target
- `node scripts/balance/run.mjs` 8/8: wrecks per race 0.2-2.0 on every track, gun share 0.45-0.65, mine hits <= 3, spread 0.75 vs 0.35 >= 0.8, lap delta <= 1 s (after re-measuring the references), career greedy 18-35 races on >= 14/16 seeds, career safe row. Wall impacts per race: report-only, flag above 4.5 (faster corners will push this up).
- **Re-measure `referenceLapTime` on all 10 tracks** (it is the 0.55 median clean lap, now faster). The tight-track rule range in `shape.test.ts` (24-32 s) will no longer fit: move it to the new measured range with a little margin and say what you chose; update `specs/content.md` section 12 to match.
- Career: since the model already plays the player as skill 0.75, the career rows should not move. If they do, explain the mechanism and fix the model rather than the economy; touching prizes or points needs a CCR in the report.
- AI wall-wreck and stuck cases (WP33): 0 timeouts in the soak on all 10 tracks.

## Acceptance tests
- [ ] Per-skill lap ratio table (P = 0.90 x old 0.55 lap) on 4 tracks inside the targets, all 10 tracks reported.
- [ ] `run.mjs` full table before and after, 8/8; wall impacts per track before/after.
- [ ] All 10 `referenceLapTime` values re-measured, the shape rule range updated, track tests green.
- [ ] `npm run verify` green.
- [ ] `docs/tuning-log.md` entry and `specs/content.md` section 8 table updated.
- [ ] Say where the user should test: quick race URL on Scrapyard with 7 AI, what lap times to expect from each AI.

## Out of scope
Car stats, weapons and their tuning, economy (unless a CCR), track layouts, new difficulty settings.
