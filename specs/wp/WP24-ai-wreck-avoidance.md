# WP24 - AI stops pushing wrecks (CCR-7)

**Small fix, before WP12.** WP23a found that an AI car can shove a wrecked car at about 6 m/s on full throttle for 70+ s: the avoidance loop in `src/sim/ai.ts` (around line 268) skips any car that is not slower than the AI (`if (speed - oSpeed <= AVOID_SLOWER) continue;`), and a wreck being pushed moves at the pusher's speed, so it never counts as blocking. The stuck detector misses it because speed stays above 1.5 m/s. The user asked to fix it now, with a re-soak of all 10 tracks.
Read first: `specs/wp/WP07-ai.md` (AI rules and soak gates), the CCR-7 note in `specs/STATUS.md`, `docs/tuning-log.md`, then `src/sim/ai.ts`, `src/sim/ai.test.ts`, `src/sim/soak.ts`, `src/content/tracks/*.ts` and their tests.
Owns: `src/sim/ai.ts`, `src/sim/ai.test.ts`, `docs/tuning-log.md` (append an entry), and only if a re-soaked median drifts out of its test tolerance: the `referenceLapTime` value in that track file and the expected values in the track tests. Anything else needs a CCR.
Dispatch: subagent (opus, effort high).

## Deliverables
- The CCR-7 fix: a wrecked car ahead always counts as blocking, whatever its speed: `if (!o.wrecked && speed - oSpeed <= AVOID_SLOWER) continue;`.
- If the regression test below still fails with that line alone, add the smallest extra rule that makes it pass (for example a progress-based stuck check: less than 10 m of progress in 3 s while racing triggers the existing recovery) and say why in the report.
- `docs/tuning-log.md`: a dated entry with the before/after table.

## Acceptance tests
- [ ] Regression test in `ai.test.ts`: on a straight, a wrecked car sits on the racing line 30 m ahead of an AI car at speed (cars scripted with `createSimWithWorld`, the wreck set `wrecked` with hp 0): within 10 s the AI's progress passes the wreck's by 5 m, and the wreck has moved less than 15 m in total. The test fails on main before the fix (show that run).
- [ ] Re-soak all 10 tracks, 16 seeds each, with the WP07 gates (all finish or end by rule, nobody stuck more than twice, wrecks 0.2-2.0 per race): before/after table per track of median clean lap, wall impacts per race, wrecks per race, end reasons. Pine Hollow seed 8 at WP23a's first start is no longer a problem (WP23a picked another start; check the old start once in a scratch run).
- [ ] `npm run verify` green.

## Out of scope
Other AI behaviour, aggression or speed tuning (WP12).
