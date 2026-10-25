# Wreckline - status
Phase: 4 (build, wave B next)   Size: L   Milestone: M1   Updated: 2026-10-25
Integration pattern: merges of a running wave go into `integ/<wave>` so main stays put while workers run; main fast-forwards after the last merge.
Next action: wave B brief and dispatch (WP07 AI, WP08 integration). Decide first: finished cars roll into walls (WP01 rule) vs AI steering them.
Remote: origin = git@github.com:underscoreloG/wreckline.git.
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
| WP | Name | Wave | Dispatch | Model | Status | Agent/session id | Branch | Notes |
|---|---|---|---|---|---|---|---|---|
| WP00 | Foundation | 0 | subagent | opus high | merged | agent a49385f5fa850e0b1 | wp/00-foundation (merged 4d085b3) | 59 tests; gzip 1342 kB |
| WP01 | Vehicle and race rules | A | subagent | opus high | merged | agent a0b65fac6f34c72da | wp/01-vehicle-race (51902d4) | 14/14; 0-100 2.17 s, lap 34.3 s (crude follower), perf 83 ms/3600 ticks |
| WP02 | Combat and pickups | A | subagent | opus high | merged | agent a15ac35ba1dc32e8a | wp/02-combat (630a638) | 13/13; T8/T9 green under WP01 dynamics on integ (92/92 total) |
| WP03 | Renderer | A | subagent | opus high | merged | agent a6a6739309f02b457 | wp/03-renderer (8c1f867) | 23 render tests; < 400 tris/car, 9 draws/car; scene 48-59k tris, 64-91 draws at high; GPU 7.9 ms/frame at 4K (proxy) |
| WP04 | UI shell and HUD | A | subagent | opus high | merged | agent aadfab483ba45c628 | wp/04-ui-hud (1ce7623) | 17 ui tests; all M1 screens + 3 HUD states render clean; integ 128/128, gzip 1568 kB |
| WP05 | Input and audio | A | subagent | opus high | merged | agent a544df2d76a3177cf | wp/05-input-audio (ce89a76) | 21 tests; 21/21 sounds pass offline level check; integ 113/113 |
| WP07 | AI drivers | B | subagent | opus high | todo | - | | |
| WP08 | Game integration | B | subagent | opus high | todo | - | | |
| WP09 | Career logic | C1 | subagent | opus high | todo | - | | after fun gate |
| WP11 | Tracks 2-3 and themes | C1 | subagent | opus high | todo | - | | after fun gate |
| WP13 | Car art prompt pack | C1 | subagent | opus high | todo | - | | after fun gate |
| WP13U | Generate car sheets and models | U1 | user:ChatGPT+Tripo | ChatGPT image + Tripo (user) | todo | - | - | brain spot-checks 1 sheet first |
| WP10 | Career UI and wiring | C2 | subagent | opus high | todo | - | | |
| WP14 | Car model import | C2 | subagent | opus high | todo | - | | pin glTF optimizer first; copy art-incoming |
| WP12 | Balance and polish | C3 | session | opus high | todo | - | | |

## Helper agents (not WPs)
| Task | When | Model | Effort |
|---|---|---|---|
| Brain (this session) | all phases | opus | high (max while dispatching reviewers) |
| Spec reviewer + recheck | Phase 3, and after any large spec change | opus | max |
| Art critic (WP14 art gate) | after wave C2 | opus | max |
| glTF optimizer version pin (npm) | before WP14 | haiku | high |
| Fact lookups during briefs | as needed | sonnet | high |
| Soak / balance probe runs outside WP12 | gates GB, GC | sonnet | high |
| WP12 session | wave C3 | claude-opus-5-5 (start_session `model`) | high (start_session `effort`, capped at the brain's own) |

## Gates
| Gate | State |
|---|---|
| G0 | pass 2026-10-25: verify green on main; fake sim 15/15 event types, car 3 wrecked; real sim drives/turns/walls hold, AI moves, finish hook 4 rows; no console errors |
| GA | pass 2026-10-25 on main 9fd625f: verify 151/151, gzip 1801 kB; real sim with stub AI races, shoots, mines, wrecks, pickups respawn; render harness draws (screenshot), all 5 harnesses load with no console errors. NOT verified: 60 fps (pane rAF unreliable: 24 rAF fps, stats 0 then 120); re-measure at GB in a real browser |
| GB / M1 | - |
| Fun gate | - |
| Art gate (after C2) | - |
| GC / M2 | - |

## Open
- For WP12/user (from WP03): AGX tone mapping makes explosions, gantry red and pickups look pastel; bloom subtle. Vite warns the raw chunk > 4096 kB (gzip budget fine). Roof-plate light trim for dark bodies left to WP14.
- Brief facts for later waves (from WP00): `__harness.step()` switches the debug view to scripted mode for good; `finishRace()` = `debugFinishRace()` + `step(1)` (raceFinished arrives on the next step); stub countdown gives raceStart on tick 180; stub params renamed with `_` prefix (names only).
- Done 2026-10-25: WP01 braking band [0.98, 1.25] and forward-only gates written into WP01; design.md car size corrected to ~135 px (WP03 measurement).
- For WP07/minor 23: WP01 makes finished cars throttle 0.3 steer 0, so they roll into walls; WP07 should steer finished AI cars or WP01 rule changes (decide at wave B brief).
- For WP12/user ears: mix not tuned by ear; gun (-18 dBFS peak) sits ~10 dB under the player engine (-8): raise gun gain first. No real gamepad tested. Audio rpm uses the starter's maxSpeed (no per-car stats in update()); optional CCR later. AZERTY: WP04 controls screen should use getLayoutMap (minor 28).
- For WP08 brief (from WP04): App needs `nav = input.onNav`; theme.css is imported by App.tsx; UI root is pointer-events none, menus auto; kill feed fades from 3.6 s but WP08 must drop items at 4 s; speedo uses MAX_KMH 200 (no max speed in HudState); title has a left scrim so the live backdrop shows. Fonts are latin subsets only (+207 kB gzip; full set was +783 kB).
- CCRs: CCR-1 (WP02) gunShot tracers in the debug view: applied on main 2026-10-25 (verify green). Not visually confirmed: the pane stopped running rAF during the check.
- WP02 notes for WP12: wall hit at 30 m/s deals 30 (restitution ~0.3); car-car 25 m/s ~17 each. Own mine sits 3.1 m behind a stopped car vs 3.0 m trigger: slow reversing can trigger it. Wreck explosion uses DamageSource 'collision' (no 'explosion' in contracts).
- Minor review items still open (`specs/REVIEW-2026-10-23.md`): 23 (finished cars coast and stay hittable), 24 (aim target and impact speed wording), 25 (names/colors past 3 AIs, TRACKS shape), 27 (sound check, fps checks need a visible pane), 28 (handbrake flag, audio car stats, layout map), 30 (easy-rival fallback wording), 31 (doc drift: GC seeds, placeProps args, WP12 probe runner).
- Before WP14: pin a glTF optimizer version on npm into SPEC.md section 2.
