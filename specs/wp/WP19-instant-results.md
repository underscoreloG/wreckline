# WP19 - Instant results after the player finishes

**Wave C2, patch release v0.3.1.** The user, after playing v0.3.0: "waiting for the ai to finish the race to go to the main menu is kinda annoying." Today the race keeps running until every car finishes or 15 s after the player finishes (content.md section 7), then 2.5 s more (`RESULTS_DELAY_TICKS`) before the results screen: up to ~17.5 s of watching.
Goal: results appear 1.5 s after the player finishes or wrecks, with exactly the same results as if the player had waited.
Read first: `specs/wp/WP08-integration.md` (state machine, per-frame loop, `__game`), `specs/content.md` section 7 (race end rules: unchanged), then `src/game/{raceSession,machine,index,loop}.ts` (+ tests), `src/sim/index.ts` (Sim API).
Owns: `src/game/**` (+ tests). Anything else needs a CCR.
Dispatch: subagent (opus, effort high).

## Behaviour
- When the player's car is `finished` or `wrecked` (whichever comes first), keep the live race on screen for `PLAYER_DONE_DELAY = 1.5 s` (the FINISHED / WRECKED banner, the car crossing the line).
- Then fast-forward: step the sim headlessly (no render, no audio, no HUD derive) until `phase === 'finished'`. The race-end rules guarantee that within 15 s of sim time after the player finished (2 s after a wreck), i.e. at most 900 ticks. Safety cap: 3600 ticks; if it is ever reached, log a console error and stop stepping (a test asserts the cap is never reached on 16 seeds).
- Show results immediately after the fast-forward. Results must be byte-identical to a run where the player waited: same seed, same inputs, same tick count. The player's inputs during the fast-forward are neutral (the player car cruises or is wrecked anyway).
- Audio: `audio.stopRace()` before the fast-forward so no burst of sounds plays. The renderer receives no events from the skipped ticks.
- If the AI cars all finish before the player, nothing changes (the race ends normally, results after the same 1.5 s).
- Quick race and career both use it. Career payouts come from `sim.result()` as before.

## Acceptance tests
- [ ] `npm test -- game`: (a) determinism: a scripted race where the player finishes first, run once with the new skip and once by stepping manually to the end with neutral input, gives deep-equal `RaceResult`; (b) the results screen is reached exactly `PLAYER_DONE_DELAY` (90 ticks) after the player's finish or wreck; (c) no audio `update` and no renderer `render` calls during the fast-forward (spy); (d) the existing machine and flow tests stay green.
- [ ] Browser (`preview_start` on your `wreckline-wp19` entry, `?race=1&seed=42&autopause=0`): drive the player with `__game.setInput` / autoplay so it finishes ahead of at least one AI car, then `__game.step(90)` after the finish: screen is `results`, rows show every car with a finish time or DNF, no console errors.
- [ ] `npm run verify` green.

## Out of scope
Changing race end rules, result ranking, career payouts, skip buttons.
