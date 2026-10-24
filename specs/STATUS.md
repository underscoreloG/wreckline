# Wreckline - status
Phase: 4 (build, wave A next)   Size: L   Milestone: M1   Updated: 2026-10-24
Next action: wave A: create worktrees + launch entries for WP01-WP05 (ports 5201-5205), brief, dispatch all 5 in one message.
Ledger edits stay uncommitted on main while a worker runs (workers check that main did not move).

Idea: top-down combat racer in the browser in the spirit of Death Rally (1996), with a modern look and UI.
Fun gate question: "After 3 quick races: is the drive-shoot-wreck loop fun enough that you want a garage and a career on top of it?"

## Decisions
- 2026-10-23 Stack: TS 7.0.2 + Vite 8.3.5 + Vitest 5.0.5 + three 0.186.1 (WebGLRenderer) + postprocessing 6.39.5 + Rapier 2D deterministic-compat 0.21.0 + React 19.3.1. Versions verified on npm.
- 2026-10-23 No ESLint (typescript-eslint 8.72 supports TS < 6.1 only); boundary script instead. WebGL, not WebGPU.
- 2026-10-23 Pure deterministic sim (fixed 60 Hz, seeded RNG, no DOM), same pattern as the football game.
- 2026-10-23 Top-down 3D, fixed north-up camera, steering relative to the car.
- 2026-10-23 Controls: arrows drive, S fire, D mine, A turbo, Space handbrake, Esc pause. Gamepad supported.
- 2026-10-23 M1 = 1 track, 4 cars, quick race only, procedural assets; M2 = career, shop, 2 more tracks. M2 never starts on a "no".
- 2026-10-23 Dev port 5181 (5180 is the football game). Worker worktrees use 5200+NN.
- 2026-10-23 Mild rubber banding on easy/medium only (hard and boss never cheat); career damage carries over, repairs cost cash.
- 2026-10-24 Roster from `specs/art/cars-concept-v1.webp`: RAVEN starter; SCORCH 6000, TITAN 11000, VIPER 16000 for sale; OUTLAW, ICEBERG, BLAZE rival-only; WRAITH boss (driver still "THE WARDEN"). Stats table in content.md section 1.
- 2026-10-24 Real car art after the fun gate (WP13, WP13U, WP14); M1 keeps procedural placeholders with per-type silhouettes.
- 2026-10-24 Car models: GPT image turnaround sheet per car, user runs Tripo, Claude imports. Race camera unchanged: cars read by silhouette + roof plate in driver color.
- 2026-10-24 Plan approved by the user. Repo initialised, spec committed on main as 0d8c5d5.
- 2026-10-24 Spec review (`specs/REVIEW-2026-10-23.md`): items 1-21 fixed; recheck found 3 new blockers + 7 rework items, all fixed. Minors 22-31 partly fixed, rest open below.
- Still assumed: working title "Wreckline", career length target 18-35 races (WP12 can move it).

## Work packages
| WP | Name | Wave | Dispatch | Status | Agent/session id | Branch | Notes |
|---|---|---|---|---|---|---|---|
| WP00 | Foundation | 0 | subagent | merged | agent a49385f5fa850e0b1 | wp/00-foundation (merged 4d085b3) | 59 tests; gzip 1342 kB |
| WP01 | Vehicle and race rules | A | subagent | todo | - | | |
| WP02 | Combat and pickups | A | subagent | todo | - | | |
| WP03 | Renderer | A | subagent | todo | - | | |
| WP04 | UI shell and HUD | A | subagent | todo | - | | |
| WP05 | Input and audio | A | subagent | todo | - | | |
| WP07 | AI drivers | B | subagent | todo | - | | |
| WP08 | Game integration | B | subagent | todo | - | | |
| WP09 | Career logic | C1 | subagent | todo | - | | after fun gate |
| WP11 | Tracks 2-3 and themes | C1 | subagent | todo | - | | after fun gate |
| WP13 | Car art prompt pack | C1 | subagent | todo | - | | after fun gate |
| WP13U | Generate car sheets and models | U1 | user:ChatGPT+Tripo | todo | - | - | brain spot-checks 1 sheet first |
| WP10 | Career UI and wiring | C2 | subagent | todo | - | | |
| WP14 | Car model import | C2 | subagent | todo | - | | pin glTF optimizer first; copy art-incoming |
| WP12 | Balance and polish | C3 | session | todo | - | | |

## Gates
| Gate | State |
|---|---|
| G0 | pass 2026-10-25: verify green on main; fake sim 15/15 event types, car 3 wrecked; real sim drives/turns/walls hold, AI moves, finish hook 4 rows; no console errors |
| GA | - |
| GB / M1 | - |
| Fun gate | - |
| Art gate (after C2) | - |
| GC / M2 | - |

## Open
- Brief facts for later waves (from WP00): `__harness.step()` switches the debug view to scripted mode for good; `finishRace()` = `debugFinishRace()` + `step(1)` (raceFinished arrives on the next step); stub countdown gives raceStart on tick 180; stub params renamed with `_` prefix (names only).
- CCRs: none.
- Minor review items still open (`specs/REVIEW-2026-10-23.md`): 23 (finished cars coast and stay hittable), 24 (aim target and impact speed wording), 25 (names/colors past 3 AIs, TRACKS shape), 27 (sound check, fps checks need a visible pane), 28 (handbrake flag, audio car stats, layout map), 30 (easy-rival fallback wording), 31 (doc drift: GC seeds, placeProps args, WP12 probe runner).
- Before WP14: pin a glTF optimizer version on npm into SPEC.md section 2.
