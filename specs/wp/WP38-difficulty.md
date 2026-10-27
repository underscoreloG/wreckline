# WP38 - Difficulty setting: Easy / Normal / Hard (CCR-13)

**User request (2026-10-27), verbatim:** "top3 and 7 as a new mode in the menu (like a destruction derby thing)" (top 3 = difficulty setting, time trial with ghosts, reversed tracks; 7 = arena). Difficulty choice (user, from the brain's options): "Everywhere, same rewards": Easy / Normal / Hard in Settings, shifts every AI's skill in quick race, career and arena; changeable anytime; prizes unchanged; Normal = the WP37 tuning. Context: "It needs to be competitive without making it too hard and make grinds for hours".

Depends on: WP37 (AI pace) merged. Read first: `SPEC.md`, `specs/contracts.ts` (Settings, AiProfile, EntrantSetup), `specs/content.md` section 8, `src/content/ai.ts` (`profileForSkill`), `src/content/quickRace.ts`, `src/meta/career.ts` (where career entrants get their AI profile, rubber band rule), `src/game/settings.ts` (+test, migrations), `src/ui/screens/Settings.tsx`, `src/meta/careerSim.ts`, `scripts/balance/run.mjs`.
Owns: `src/content/ai.ts`, `src/content/quickRace.ts`, the entrant-profile lines in `src/meta/career.ts`, `src/game/settings.ts` (+test), the difficulty row in `src/ui/screens/Settings.tsx` and `src/ui/fixtures.ts`, the place in `src/game` that builds a race setup from settings (only to pass difficulty through), both contracts copies (CCR-13 only), `scripts/balance/**` (a difficulty option), `specs/content.md` section 8, `docs/tuning-log.md` (append).
Dispatch: subagent (opus, effort high). Branch `wp/38-difficulty`, worktree `../wreckline-wt/wp38`.

## Change
- CCR-13 (pre-approved): `Settings.difficulty: 'easy' | 'normal' | 'hard'`, default `'normal'`; settings migration fills the default. 
- `DIFFICULTY_SKILL_OFFSET` in `src/content/ai.ts`: easy -0.2, normal 0, hard +0.15 (named constants). Every AI entrant's skill becomes `clamp(skill + offset, 0, 1.1)` before `profileForSkill`, in quick race, career (rivals and THE WARDEN) and any later mode that builds AI entrants through the same function (make it one exported helper so WP41's arena uses it too).
- Career: rubber banding stays as is (easy/medium tiers only, hard and boss 0). Prizes, points, prices unchanged. Rival ladder points are not affected (difficulty changes how they drive, not their stats).
- Settings screen: a DIFFICULTY row with EASY / NORMAL / HARD, same style as the quality row, applied to the next race.
- The pre-race screen shows the current difficulty in small text (so a player knows why a race felt hard).

## Acceptance tests
- [ ] Unit: migration default; offset applied and clamped (boss stays 1.1 on hard, 0.9 on easy); the helper used by quick race and career setups.
- [ ] `run.mjs` at normal unchanged (8/8, same numbers as main). Add a `--difficulty easy|hard` option and report the per-skill lap ratios and the career greedy row at easy and hard (report only: expect easy shorter, hard longer).
- [ ] Browser: Settings shows the row, changing it changes the next quick race's AI (say how you checked, for example the setup's profiles via `__game`), no console errors.
- [ ] `npm run verify` green.

## Out of scope
Different rewards per difficulty, per-race difficulty pickers, AI behaviour changes.
