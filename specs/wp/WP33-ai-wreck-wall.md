# WP33 - AI glued to a wreck at the wall: reverse away from the wall

**Source:** WP31 CCR (2026-10-26), accepted by the brain for the tight-track rework (user: "Merge WP31 and redraw the other 9 tracks the same way"). On a Scrapyard draft (seed 9, start 2) car 0 reversed and re-hit, for 25 s, a wreck lying in the 4 m shoulder against the outer wall, and the race timed out. The final Scrapyard has 0 timeouts, but every tight track has 4 m shoulders and tighter bends, so the case will come back in WP32.

Read first: `SPEC.md`, `src/sim/ai.ts` (the CCR-8 glued logic around `WRECK_CRAWL`, `WRECK_GLUE_RANGE`, `WRECK_REVERSE_TIME`, the stuck timer and the reverse phase), `src/sim/ai.test.ts` (the CCR-8 recovery test on `RAIN_DISTRICT_FIXTURE`), `src/content/tracks/fixtures.ts`, `src/sim/soak.ts`, `docs/tuning-log.md` (CCR-8 and WP31 entries).
Owns: `src/sim/ai.ts`, `src/sim/ai.test.ts`. Read only: everything else (WP32a/b/c redraw tracks in parallel in `src/content/tracks/**`; do not touch them).
Dispatch: subagent (opus, effort high). Branch `wp/33-ai-wreck-wall`, worktree `../wreckline-wt/wp33`. No browser check needed.

## Change
- During the glued reverse (and the turn-out after it), steer so the car backs out away from the wall and the wreck: choose the reverse steer from the side the wreck and the nearest wall are on (the track geometry gives the wall side from the car's lateral offset), so that after reversing the nose points to the open road, not back along the wall into the wreck.
- If the AI is glued again to the same wreck right after a reverse, the next reverse goes longer or harder to the open side (bounded, a named constant); never loop forever.
- Named constants for anything new; no change to any behaviour outside the glued case (normal stuck recovery, racing line, weapons).

## Acceptance tests
- [ ] A new unit test that builds the failing case: a wreck lying in the shoulder against the outer wall on a fixture track (any frozen fixture), an AI driving into it along the wall; with the fix the AI is past the wreck within a bound you state (for example 6 s), and the test fails on the old code (show the old result).
- [ ] The existing CCR-8 recovery test and every `ai.test.ts` test stay green with unchanged intent.
- [ ] `node scripts/balance/run.mjs`: 8/8 before and after (or the honest list), wrecks and timeouts per track before/after. Soak outcomes are chaotic, so any behaviour change moves them: report what moved.
- [ ] `npm run verify` green.

## Out of scope
Track layouts (WP32), aggression or mine tuning, car handling.
