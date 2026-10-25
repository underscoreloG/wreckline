# Wreckline - status
Phase: 5 (fun gate: the user plays v0.2.1)   Size: L   Milestone: M1   Updated: 2026-10-25
Integration pattern: merges of a running wave go into `integ/<wave>` so main stays put while workers run; main fast-forwards after the last merge.
Next action: the user plays v0.2.1 and answers the fun gate. Yes -> wave C1 (WP09, WP11, WP13, WP15). Knobs ready if asked: AGGRESSION_SCALE 0.2 -> 0.3 (more carnage, probed: 0.31 wrecks, gap 1.06); pickup respawn 8 -> 12 s if bonuses feel too many.
Remote: origin = git@github.com:underscoreloG/wreckline.git (public since 2026-10-25; Pages source = GitHub Actions, set by the user; site will be https://underscorelog.github.io/wreckline/ - not yet deployed).
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
- 2026-10-25 Finished cars cruise along the racing line at 60% pace (`cruiseInput`, WP07) and are immune: no damage, no wreck, no weapons, mines or pickups. WP07 owns the vehicle.ts/combat.ts edits for it.
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
| WP07 | AI drivers | B | subagent | opus high | merged | agent a90c0dfb365a0356c | wp/07-ai (27490dc) | 24 AI tests; median 0.55 lap 30.95 s; 0.75 wrecks/race; 0.029 ms/tick; finished-car cruise + immunity |
| WP08 | Game integration | B | subagent | opus high | merged | agent ad9b023c548dd07cf | wp/08-integration (221b8d7) | 34 game tests; flow, settings, memory pass |
| WP09 | Career logic | C1 | subagent | opus high | todo | - | | after fun gate |
| WP11 | Tracks 2-3 and themes | C1 | subagent | opus high | todo | - | | after fun gate |
| WP13 | Car art prompt pack | C1 | subagent | opus high | todo | - | | after fun gate |
| WP13U | Generate car sheets and models | U1 | user:ChatGPT+Tripo | ChatGPT image + Tripo (user) | todo | - | - | brain spot-checks 1 sheet first |
| WP10 | Career UI and wiring | C2 | subagent | opus high | todo | - | | |
| WP14 | Car model import | C2 | subagent | opus high | todo | - | | pin glTF optimizer first; copy art-incoming |
| WP15 | Sound list (Pixabay picks) | C1 | subagent | sonnet high | todo | - | | after fun gate |
| WP15U | Download the sounds | U1 | user:Pixabay | Pixabay (user's browser) | todo | - | - | user checks each licence |
| WP16 | Sound import and mix | C2 | subagent | opus high | todo | - | | copy art-incoming/sfx; listening session with user after merge |
| WP17 | M1 tuning pass 1 (faster, more pickups) | 5 | subagent | opus high | merged | agent afc590ff684ca968e | wp/17-tuning-1 (8033df0) | lap 30.95->27.70 s; walls 1.75->2.94/race; wrecks 0.75->0.25; pickups 8.7->21.9/race; gap 1.25->0.88; released v0.2.1 |
| WP12 | Balance and polish | C3 | session | opus high | todo | - | | |

## Helper agents (not WPs)
| Task | When | Model | Effort |
|---|---|---|---|
| Brain (this session) | all phases | opus | high (max while dispatching reviewers) |
| Spec reviewer + recheck | Phase 3, and after any large spec change | opus | max |
| Art critic (WP14 art gate) | after wave C2 | opus | max |
| glTF optimizer version pin (npm) | before WP14 | haiku | high |
| Fact lookups during briefs | as needed | sonnet | high |
| Sound listening session (after WP16) | wave C2 | brain with the user | - |
| Soak / balance probe runs outside WP12 | gates GB, GC | sonnet | high |
| WP12 session | wave C3 | claude-opus-5-5 (start_session `model`) | high (start_session `effort`, capped at the brain's own) |

## Gates
| Gate | State |
|---|---|
| G0 | pass 2026-10-25: verify green on main; fake sim 15/15 event types, car 3 wrecked; real sim drives/turns/walls hold, AI moves, finish hook 4 rows; no console errors |
| GA | pass 2026-10-25 on main 9fd625f: verify 151/151, gzip 1801 kB; real sim with stub AI races, shoots, mines, wrecks, pickups respawn; render harness draws (screenshot), all 5 harnesses load with no console errors. NOT verified: 60 fps (pane rAF unreliable: 24 rAF fps, stats 0 then 120); re-measure at GB in a real browser |
| GB / M1 | pass 2026-10-25 on main: verify 215/215, gzip 1808 kB; autoplay race seed 42 all 4 finish 93-97 s, no console errors; full keyboard flow title-preRace-race-pause-resume-results; live race 120 fps (p50 8.3 ms, p95 9.3 ms, 87 draws) in a visible pane ~1474x1466 backing; released as v0.2.0 |
| Fun gate | - |
| Art gate (after C2) | - |
| GC / M2 | - |

## Open
- From WP17: wrecks (0.25) and skill gap (0.88) sit near WP07's floors; playerWrecked endings 4 -> 0 (more repairs). Pickups collected x2.5. Optional CCR: explicit `fx.speedStreaks` quality flag instead of reusing `headlightCones` (render only, not applied).
- From WP07 (watch at fun gate): AGGRESSION_SCALE = 0.2 in ai.ts. At 1.0 the pack shot the leader (usually the player) to a wreck in ~15 s; at 0.3, 9 of 16 races ended with the player wrecked. Skill gaps are small (laps 31.2-32.2 s); positions come from grid order and combat. LAT_ACCEL measured grip*64 (turn-rate limited model). First-lap pile-ups at the tight corner seen (seed 7 cost ~12 s), cars recover.
- For WP12/user (from WP03): AGX tone mapping makes explosions, gantry red and pickups look pastel; bloom subtle. Vite warns the raw chunk > 4096 kB (gzip budget fine). Roof-plate light trim for dark bodies left to WP14.
- Brief facts for later waves (from WP00): `__harness.step()` switches the debug view to scripted mode for good; `finishRace()` = `debugFinishRace()` + `step(1)` (raceFinished arrives on the next step); stub countdown gives raceStart on tick 180; stub params renamed with `_` prefix (names only).
- Done 2026-10-25: WP01 braking band [0.98, 1.25] and forward-only gates written into WP01; design.md car size corrected to ~135 px (WP03 measurement).
- For WP12/user ears: mix not tuned by ear; gun (-18 dBFS peak) sits ~10 dB under the player engine (-8): raise gun gain first. No real gamepad tested. Audio rpm uses the starter's maxSpeed (no per-car stats in update()); optional CCR later. AZERTY: WP04 controls screen should use getLayoutMap (minor 28).
- For WP08 brief (from WP04): App needs `nav = input.onNav`; theme.css is imported by App.tsx; UI root is pointer-events none, menus auto; kill feed fades from 3.6 s but WP08 must drop items at 4 s; speedo uses MAX_KMH 200 (no max speed in HudState); title has a left scrim so the live backdrop shows. Fonts are latin subsets only (+207 kB gzip; full set was +783 kB).
- CCRs: CCR-1 (WP02) gunShot tracers in the debug view: applied on main 2026-10-25 (verify green). Not visually confirmed: the pane stopped running rAF during the check.
- WP02 notes for WP12: wall hit at 30 m/s deals 30 (restitution ~0.3); car-car 25 m/s ~17 each. Own mine sits 3.1 m behind a stopped car vs 3.0 m trigger: slow reversing can trigger it. Wreck explosion uses DamageSource 'collision' (no 'explosion' in contracts).
- Minor review items still open (`specs/REVIEW-2026-10-23.md`): 23 (finished cars coast and stay hittable), 24 (aim target and impact speed wording), 25 (names/colors past 3 AIs, TRACKS shape), 27 (sound check, fps checks need a visible pane), 28 (handbrake flag, audio car stats, layout map), 30 (easy-rival fallback wording), 31 (doc drift: GC seeds, placeProps args, WP12 probe runner).
- Before WP14: pin a glTF optimizer version on npm into SPEC.md section 2.
- From WP08: App is mounted by src/game/index.ts (rule 5: main.tsx may not create input/audio), accepted. Any keydown/pointerdown unlocks audio. Results delay counts 150 sim ticks. Title backdrop restarts its fake race every ~7 min (wrecked-car reset visuals unchecked). Pages workflow runs on push to main.
- 2026-10-25 Playtest of v0.2.0, user verbatim: "seems to be working great, it is a little bit too slow in my opinion. And I would love a little bit more bonuses on the race". Chosen: all cars maxSpeed x1.15 / accel x1.20, camera 46-62 m + turbo speed streaks; Scrapyard pickups 6 -> 12, respawn 12 -> 8 s. New pickup kinds not now (M2 if wanted). -> WP17.
- 2026-10-25 Sound specs written: WP15 (Pixabay picks), WP15U (user downloads), WP16 (import + mix, synth fallback, engine stays synth). Default timing after the fun gate.
