# WP40 - Time trial with a ghost of your best lap (CCR-15)

**User request (2026-10-27):** see WP38 (top 3 from the genre comparison). Choice (user): "Any car, best per track+car": solo on any track and direction with any of the 8 cars (stock), no weapons or pickups, a ghost of your best lap; best laps saved locally per track, direction and car. Why (genre research): time attack with ghosts is the main replay driver in Circuit Superstars, Art of Rally and Super Woden GP.

Depends on: WP39 merged (directions). Read first: `SPEC.md`, `specs/contracts.ts`, `src/game/machine.ts`, `src/game/index.ts`, `src/game/store.ts`, `src/ui/screens/Title.tsx`, `src/ui/screens/PreRace.tsx` (track/car/reverse pickers to reuse), `src/content/quickRace.ts`, `src/sim` race rules (how a 1-entrant race and laps work), `src/render` car building (`buildCarParts`, materials), `src/ui/hud/**`, `src/game/settings.ts` (storage pattern).
Owns: new files for the mode (`src/game/timeTrial*.ts`, `src/meta/ghost*.ts` or similar, `src/render/ghostCar.ts`, `src/ui/screens/TimeTrial*.tsx`), the TIME TRIAL entry in `Title.tsx`, the mode's transitions in `src/game/machine.ts` / `index.ts`, the HUD delta readout, both contracts copies (CCR-15 only), tests for all of it.
Dispatch: subagent (opus, effort high). Branch `wp/40-time-trial`, worktree `../wreckline-wt/wp40`, dev port 5240.

## Change
- Title menu: TIME TRIAL (between QUICK RACE and CAREER). Setup screen: track, REVERSE toggle, car (any of 8, stock), START; shows the best lap for the current track, direction and car.
- On track: the player alone (no AI), no weapons, no mines, no turbo pickups or any pickups, unlimited laps (the run continues until the player quits); the first lap is a flying start or a standing start, choose and say why. HUD: current lap time, best lap, live delta to the best lap (green/red), last lap.
- Instant restart key (R on keyboard, Select/Back on gamepad, shown in the pause menu): back to the start line in under a second.
- Ghost: record the player's pose (x, y, heading) at 20 Hz during each lap, quantised (for example int16 in a local frame); when a lap beats the best, it becomes the best: store `{ time, poses }` in localStorage under a new versioned key, per `trackId + direction + carId` (budget: about 2 kB per entry; 160 entries must fit well under 1 MB). The ghost of the best lap replays from each lap start, interpolated to the frame, as a translucent copy of the same car model (no collision, no shadow, no lights, no engine sound), toggle in pause menu (default on).
- Results on quit: lap list with the best highlighted, "New best!" if improved.
- CCR-15 (pre-approved, justify any change): `Screen` gains the time trial screens; a race mode marker on the setup (for example `RaceSetup.mode?: 'race' | 'timeTrial'`) so the sim and HUD can skip AI, weapons and pickups. Deterministic sim untouched.
- Music: race tracks as in a race. Difficulty: not used.

## Acceptance tests
- [ ] Unit: ghost encode/decode round trip (error under 5 cm and 0.5 deg), storage key per track+direction+car, best-lap replacement only on improvement, size per entry, corrupt or old storage ignored safely.
- [ ] Sim test: a time trial setup has one entrant, no pickups spawned, weapons inert, laps counted without end.
- [ ] Browser (screenshots 1280x720 into `../wreckline-wt/wp40-shots/`): the setup screen with a best time; a lap with the ghost visible ahead and the delta readout; the restart key returns to the start; quitting shows the lap list; reload keeps the best and the ghost. No console errors. Drive with `autoplay=1` or the dev API to set laps.
- [ ] `npm run verify` green; bundle budget figure reported.

## Out of scope
Online leaderboards, watchable replays, ghosts of other players, time trial in career.
