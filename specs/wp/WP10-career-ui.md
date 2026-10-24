# WP10 - Career UI and wiring

Goal: the career is playable end to end: hub, garage with live 3D car preview, shop, race select, standings, champion screen, saves.
Read first: `SPEC.md`, `specs/contracts.ts` (UiState, GameCommand, meta), `specs/design.md` sections 4-5 (M2 screens), WP04 (components, focus hook), WP08 (machine), WP09 (career API).
Depends on: WP09 merged (real meta functions), WP08 merged.
Owns, in wave C2 (WP04 and WP08 are long merged, nobody else writes these paths in C1-C2): `src/ui/**` (career screens and the edits to WP04 files listed below), `src/ui/career.css`, and `src/game/**` (career commands in `machine.ts`, a `careerSession.ts`). Edits to WP04's files are limited to: `screens/Title.tsx` (CAREER entry + sub-menu), `screens/Results.tsx` (payout panel and PRIZE column, design.md section 5), `App.tsx` (route career screens), `fixtures.ts` and `harness.tsx` (career fixtures), each listed in the report.

## Deliverables
- Screens: `CareerHub.tsx`, `Garage.tsx` (+ `CarPreview.tsx`: own `WebGLRenderer`, 512x320 canvas, `buildCarMesh` from `src/render`, turntable 0.4 rad/s, 3-point studio light, disposed on unmount), `Shop.tsx` (tabs UPGRADES / SUPPLIES / CARS), `RaceSelect.tsx`, `Standings.tsx`, `Champion.tsx`, plus a `Payout` panel added to results when `state.lastPayout` is set.
- `src/game/careerSession.ts`: holds the save, calls WP09 functions, persists with `writeSave(localStorageAdapter, save)` after every change.
- Title: CAREER enabled; if a save exists, a sub-menu CONTINUE / NEW CAREER (NEW CAREER asks to confirm when a save exists: "Overwrite current career?").

Command handling:

| Command | Effect |
|---|---|
| newCareer | `newCareer(seed)`, save, -> career |
| continueCareer | `loadSave`, -> career (if null -> toast error, stay) |
| navigate raceSelect | `generateOffers` once per round (keep until a race is run), -> raceSelect |
| selectOffer | if hp <= 0 -> toast "Repair your car first", stay; else build setup, `state.race` filled, -> preRace |
| startRace | as WP08 |
| race finished -> results | `applyRaceResult`, `state.lastPayout`, save; CONTINUE -> champion if `championWon` was just set, else career |
| buyUpgrade / buyCar / repair / buyMines / buyTurbo | WP09 shop fn; ok -> save + `buy` sound + cash flash; fail -> `error` sound + toast with the reason ("Not enough cash", "Maxed out", ...) |
| quitRace (career) | counts as DNF: `applyRaceResult` with the player row `finished: false` (prize 0), then career |

## Acceptance tests
- [ ] `npm test -- game` -> career command handling tests (fake storage adapter): buy flow, repair gating, quit = DNF.
- [ ] `?harness=ui&screen=<career|garage|shop|raceSelect|standings|champion>` render with fixtures, no console errors, screenshots in the report.
- [ ] Browser pane flow with key events and `__game.step`: new career -> race select -> pick easy -> start -> `__game.finishRaceNow()` -> results with payout -> continue -> shop -> buy engine 1 -> cash reduced by 300 -> reload page -> continue career -> cash and upgrade persisted.
- [ ] Garage preview: mount/unmount 20 times (above Chrome's active WebGL context limit, so a leak shows), WebGL contexts are released (no "Too many active WebGL contexts" warning).

## Allowed deferrals
None.

## Out of scope
Balance numbers (WP12), new art, career difficulty options.
