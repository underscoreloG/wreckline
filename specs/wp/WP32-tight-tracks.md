# WP32 - Redraw the other 9 tracks Death Rally tight (WP32a, WP32b, WP32c)

**User request (2026-10-27), verbatim:** "Scrapyard feels right. Merge WP31 and redraw the other 9 tracks the same way." The user drove the WP31 pilot (Scrapyard) and approved it.

Three workers run in parallel, each on its own branch and worktree, each on its own three tracks:

| WP | tracks | branch | worktree | dev port |
|---|---|---|---|---|
| WP32a | dustBowl, dockside, frostbite | wp/32a-tight-tracks | ../wreckline-wt/wp32a | 5232 (launch entry `wreckline-wp32a`) |
| WP32b | neonMile, rainDistrict, redrock | wp/32b-tight-tracks | ../wreckline-wt/wp32b | 5242 (`wreckline-wp32b`) |
| WP32c | junkyardSprint, pineHollow, blastPit | wp/32c-tight-tracks | ../wreckline-wt/wp32c | 5252 (`wreckline-wp32c`) |

Read first: `SPEC.md`, `specs/content.md` section 12 (the "Track shape" block is the rule book, and the Scrapyard block shows how WP31 built a tight track), `docs/tuning-log.md` (the 2026-10-26 WP31 entry, its "Notes for WP32" especially), `src/content/tracks/scrapyard.ts` + `scrapyard.test.ts` (the reference), `roundedLoop.ts`, `trackTestKit.ts`, `shape.test.ts`, `placeProps.ts`, then your three track files and their tests. `src/shared/trackGeometry.ts`, `src/sim/**`, `scripts/balance/**`: read only.

Owns (per worker): `src/content/tracks/<track>.ts` and `src/content/tracks/<track>.test.ts` for your three tracks only. WP32a also owns the Dockside water: the `water` line in `src/render/themes/docks.ts` and the Dockside water test block in `src/render/themes/themes.test.ts` (nothing else in those files). Nothing else: no edit to `specs/**`, `docs/**`, `shape.test.ts`, `index.ts`, `index.test.ts`, `trackTestKit.ts`, `roundedLoop.ts`, `fixtures.ts`, `scrapyard.*`, or any other worker's track. The brain writes content.md and the tuning log from your report. A change you need elsewhere is a CCR in the report.
Dispatch: subagent (opus, effort high), three at once. WP33 (an AI fix in `src/sim/ai.ts`) runs in parallel; if the brain tells you it landed, `git merge main` into your branch and re-run your probes before reporting.

## 1. Per track
- Same `id`, `name`, `theme`, `width`. `shape: 'tight'` on the exported def (`TrackDef & { shape: 'tight' }`, as Scrapyard), so `shape.test.ts` checks it with the rules in content.md section 12: near-straight <= 0.25, every straight <= 80 m (the start straight <= 100 m), corners >= 10, turning >= 110 deg per 100 m, minRadius >= 12 m, validateTrack passes, referenceLapTime 24-32 s re-measured with the soak method.
- Build with `roundedLoop` like Scrapyard: corner radius 22 is the safe floor after short links (under 22 the spline overshoot breaks validateTrack's min radius >= width); hairpins as two back-to-back 90s whose vertices sit exactly 2 r apart. Shoulder: start at 4 (WP31: 2-3 m doubled the wall hits).
- **Length budget** (so the cross-track "Blast Pit is the longest" test holds without coordination): Junkyard Sprint 750-850 m, Blast Pit 1010-1060 m, every other track 850-990 m.
- Keep each track's character, rewritten tight (this replaces the "signature" column of the content.md track list; the old "straight >= 150 m" and 1100-1500 m rules are gone for tight tracks):

| track | theme, width | tight signature | must keep |
|---|---|---|---|
| dustBowl | desert, 15 | the most open tight track: wider bends (r 26-34 mixed with 22s), a long sweeper chain, one hairpin | desert props |
| dockside | docks, 13 | square-ish 90 deg corners round container stacks, a chicane, a quay section along the water | the sea: a quay section where at least 60 m of the outer wall runs within 3 m of the water line, every wall and prop on the land side; move the `water` point/normal in docks.ts to your new quay and update its test; more light poles than Scrapyard |
| frostbite | snow, 13 | narrow switchbacks between snowbanks and pines, at least two hairpins | snowbank, pine, lightPole props |
| neonMile | city, 14 | quick right-angle corners round city blocks, billboards; its hairpin is a U-turn round the last block | building, billboard props; more light poles than Scrapyard |
| rainDistrict | city, 14 | chicane chain through narrow streets; the old boulevard becomes the start straight (<= 100 m), hairpin turnaround at its end | more light poles than Neon Mile (same worker) |
| redrock | quarry, 16 | wide flowing quarry bends with a pinch point; the hairpin is the pinch, the crane outside its wall swings its jib over the road | `REDROCK_CRANE_S` at the new hairpin apex, crane test |
| junkyardSprint | scrapyard, 14 | the shortest and most violent: a hairpin at each end, made for ramming | its prop kinds |
| pineHollow | snow, 14 | forest sweeper chain with one blind kink, hairpin at the far end of the forest | pine, snowbank, lightPole props |
| blastPit | quarry, 16 | double loop around two pits (no crossing), the longest track, hairpin between the pits under the crane | `BLAST_PIT_CRANE_S` at the new hairpin apex; longest-track test |

- Pickups: about one per 75-90 m (10-14), every kind at least twice, cash the most common; mix of on-line and off-line (lateral +-5.5 on a 14 m road is outside the AI's line band; scale for your width: `width / 2 - 1.5`).
- Props: same rule tables re-fitted to the new length (s ranges), same kinds and look; scatter as today.
- Tests (`<track>.test.ts`): drop the legacy length 1100-1500 and straight >= 150 checks, keep or add: validate, hairpin(s) where the signature says, `trackContentTests`, the signature asserts in the "must keep" column, a length check against your budget. Never weaken a content check you did not have to change; list each change.

## 2. Probing (the soak is chaotic, see the WP31 notes)
Probe each candidate layout with `node scripts/balance/run.mjs --tracks <id> --skip-career` and its test file. Per track, report before/after and stay inside: wrecks per race 0.2-2.0, timeouts 0, nobody stuck more than twice, wall impacts per race <= 4.5, mine hits per race <= 3.5, the 0.55 median clean lap within referenceLapTime +- 1 s. Report gun damage share per track (expected 0.3-0.45 on tight tracks, not gated here). The all-track mine and gun rows are the brain's job after all merges (a tuning WP may follow, knobs `MINE_USE_SCALE`, `AGGRESSION_SCALE`): do not touch `src/sim`.

## 3. Browser check
Your own dev server (the launch entry above, the brain added it). Per track: a quick race `?race=1&track=<id>&ai=7&laps=3&autoplay=1` runs with no console errors; one 1280x720 canvas capture of a race moment, and one top-down old vs new centerline outline image (any simple render), into `../wreckline-wt/wp32-shots/<track>-*.{jpg,png}`. Canvas capture: `__game.step(n)` then `canvas.toBlob(cb, 'image/jpeg', 0.92)` and POST `await blob.arrayBuffer()` (not the Blob: CORS preflight) to a small node receiver you write in your own worktree's tmp folder, on your dev port + 1000. Stop the dev server and the receiver when done.

## Acceptance tests
- [ ] `shape.test.ts` lists your three tracks as tight and they pass; your three track test files pass.
- [ ] Per track: the shape numbers next to the targets, the length inside the budget, the probe table (section 2) before/after.
- [ ] `node scripts/balance/run.mjs` (all tracks): report the full table honestly; the all-track mine and gun rows may miss, say by how much.
- [ ] Browser: section 3 per track.
- [ ] `npm run verify` green on your branch.
- [ ] Report: per track a short content.md block (stats line like the Scrapyard one, the corner list in one line, pickups) for the brain to paste, and the tuning-log rows (changed values, before/after).

## Out of scope
Scrapyard, camera, AI code (WP33), car handling, career economy, contracts.
