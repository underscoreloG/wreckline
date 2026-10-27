# WP34 - Gun retune for tight tracks (+ shared hairpin test helper)

**User decision (2026-10-27), verbatim:** "Merge WP33, WP32a, WP32b, WP32c into main, then spec and dispatch a gun retune WP before the release." After all 10 tracks went Death Rally tight (WP31, WP32), `node scripts/balance/run.mjs` on main is 7/8: **gun damage share 0.36, target 0.45-0.65** (per track 0.27-0.41, Neon Mile lowest). Before the redraw it was 0.53. The AI's 10 deg fire cone (`GUN_CONE` in `src/sim/ai.ts`) rarely lines up in constant bends, so mines and rams take a bigger share. The user chose a retune over lowering the target: shooting must stay as big a part of the race as it was at the fun gate.

Read first: `SPEC.md`, `docs/tuning-log.md` (the WP12 entry that set `AGGRESSION_SCALE` and `MINE_USE_SCALE`, the 2026-10-26 WP31 and 2026-10-27 WP32 entries), `specs/content.md` section 12 ("Track shape", "Tight layouts (WP32)"), `src/sim/ai.ts` (weapons part: `GUN_CONE`, `MINE_CONE`, aggression and mine use), `src/sim/combat.ts` (aim assist), `src/content/weapons.ts`, `scripts/balance/run.mjs` and what each row measures.
Owns: `src/sim/ai.ts`, `src/sim/ai.test.ts`, `src/content/tracks/trackTestKit.ts` and the track test files listed in part 2 (test code only), `docs/tuning-log.md` (append one entry). Read only: `src/content/weapons.ts`, `src/sim/combat.ts` and everything player-facing (gun damage, fire rate, `GUN_AIM_CONE`): the player's gun must feel the same; a change there is a CCR in the report, not an edit.
Dispatch: subagent (opus, effort high). Branch `wp/34-gun-retune`, worktree `../wreckline-wt/wp34`. No browser check needed beyond one quick race with no console errors if you want it.

## 1. Retune (AI side only)
- Target: `node scripts/balance/run.mjs` 8/8, with gun damage share in 0.45-0.65 and every other row still inside (wrecks 0.2-2.0 on every track, mine hits <= 3, spread >= 0.8, lap delta <= 1 s, the three career rows). Aim for a margin, not the edge: gun share around 0.5, mines not above 2.9.
- Knobs, in this order of preference, each a named constant with a one-line why: the AI fire cone `GUN_CONE` (or making it widen in bends, using the track curvature the AI already samples); `AGGRESSION_SCALE`; `MINE_USE_SCALE` (fewer mines raises the gun share without more wrecks). Do not change the racing line, handling, or the glued-wreck logic (WP33).
- Watch wrecks per race: more shooting means more wrecks. The career rows (greedy champion in 18-35 races on >= 14/16 seeds) must stay inside.
- Report the probe trail: each candidate tried and its gun / mines / wrecks / career result, so the next tuning pass knows the slope.

## 2. Shared hairpin helper (CCR from WP32a/b/c)
The 10 m window hairpin measure (the shape metric's k > 1/25 runs, as in `scrapyard.test.ts`) was copied into several track test files because `tightestTurn` / `hairpins` in `trackTestKit.ts` split a hairpin built from two back-to-back 90s. Move it into `trackTestKit.ts` as one exported helper and use it from every test file that has a copy (find them with grep; expected: scrapyard, dustBowl, dockside, frostbite, neonMile, junkyardSprint). Same assertions, same numbers: a pure refactor of test code, no track file changes.

## Acceptance tests
- [ ] `node scripts/balance/run.mjs`: 8/8, the full table before and after, and the probe trail.
- [ ] `ai.test.ts` green with unchanged intent; if a test pins an old constant, say what you changed and why.
- [ ] No hand-copied hairpin measure left in track tests (grep shown); all track tests green with the same assertions.
- [ ] `npm run verify` green.
- [ ] `docs/tuning-log.md`: one dated entry (changed values table, before/after balance table, notes).

## Out of scope
Player gun, weapons content, track layouts, the AI stuck cases from the WP33 CCR (nose-in square to the wall, mid-track hairpin glue, no-motion pin), camera, career economy.
