# WP05 - Input and audio

Goal: keyboard + gamepad produce `InputFrame`s and UI nav events, and the race sounds alive with fully procedural Web Audio (engines, guns, explosions, impacts, skids, pickups, UI).
Read first: `SPEC.md`, `specs/contracts.ts` (InputSource, AudioEngine, SimEvent, CarState), `specs/wp/WP04-ui-hud.md` (bindings table, must match).
Depends on: WP00. Develop against `createFakeSim`.
Owns: `src/input/**`, `src/audio/**`. Anything else needs a CCR.

## Part 1 - Input (`src/input/`)

| File | Does |
|---|---|
| `index.ts` | `createInputSource(target: Window): InputSource` merging keyboard and gamepad |
| `keyboard.ts` | key state by `KeyboardEvent.code`, cleared on `blur` and `visibilitychange` |
| `gamepad.ts` | polls `navigator.getGamepads()`, first `mapping === 'standard'` pad |
| `merge.ts` | pure merge of keyboard + gamepad state into an InputFrame (unit tested) |
| `harness.ts` | `?harness=input`: live InputFrame readout, nav events log, gamepad id |

Rules:
- Bindings exactly as in WP04's table. Keyboard codes: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `KeyS`, `KeyD`, `KeyA`, `Space`, `Escape`. Use `code`, not `key`, so AZERTY layouts get the same physical keys. Note for the report: on AZERTY the physical S/D/A keys are labelled S/D/Q; the controls screen shows `code`-based labels from `KeyboardEvent` layout map when available (`navigator.keyboard?.getLayoutMap()`), else the QWERTY letter.
- `preventDefault` on arrows and Space (page scroll) only while the canvas/game has focus (not when an input element is focused).
- Keyboard steering is digital but smoothed: `steer` ramps toward the target at 8 per second (0 -> 1 in 0.125 s) and returns to 0 at 12 per second. Throttle/brake are digital 0/1.
- Gamepad: left stick X with radial deadzone 0.15 and response curve `sign(x) * ((|x| - 0.15) / 0.85)^1.5`; d-pad left/right = -1/+1 (overrides the stick); RT (button 7 value) throttle, LT (button 6) brake, both with deadzone 0.05.
- Merge: per field, the larger magnitude wins (steer: the source that moved last wins if both non-zero). Booleans OR.
- `usingGamepad()`: true after any gamepad input above deadzone, false after any key press.
- Nav events: arrows / d-pad / stick (with 0.5 threshold and 180 ms repeat delay, 90 ms repeat rate), Enter/Space and gamepad A = `confirm`, Escape and gamepad Start = `pause`, gamepad B = `back`. The UI maps `pause` to back in menus (WP04 nav mapping).

Acceptance tests (input):
- [ ] `npm test -- input` -> merge, deadzone curve, steer ramp timing (0.125 s to full at 60 Hz = 8 ticks +- 1), nav repeat timing tests pass.
- [ ] `?harness=input` with the keyboard: holding Up shows throttle 1; tab away and back: all keys released.

## Part 2 - Audio (`src/audio/`)

| File | Does |
|---|---|
| `index.ts` | `createAudioEngine(): AudioEngine` |
| `bus.ts` | AudioContext, master gain -> compressor (`DynamicsCompressorNode`, threshold -18 dB, ratio 4) -> destination; sfx gain |
| `engine.ts` | one engine voice per car |
| `sfx.ts` | one-shot synths: gun, explosion, impact, mine beep, pickup, turbo whoosh, countdown beeps, UI sounds |
| `skid.ts` | looping filtered noise per car, gain from drift |
| `noise.ts` | shared white/pink noise AudioBuffers (2 s, generated once with a seeded RNG) |
| `harness.ts` | `?harness=audio`: buttons for every sound, a "fake race" toggle running the fake sim, volume sliders, voice count readout |

Synthesis recipes (starting points, tune by ear and note changes in the report):
- **Engine** (per car): 2 oscillators (sawtooth + square at 0.5x frequency) -> lowpass (Q 4) -> gain -> StereoPanner. `rpm01 = clamp(|speed| / maxSpeed, 0, 1)` with a fake 3-gear sawtooth: `gear = min(2, floor(rpm01 * 3))`, `g = rpm01 * 3 - gear`, `freq = 55 + (g * 0.7 + 0.3) * 95 + gear * 12` Hz. Lowpass cutoff `400 + throttle-ish (speed rising) * 1800` Hz. Gain: player 0.28, AI 0.12 * distance falloff (`1 / (1 + d / 25)`, silent beyond 120 m). Pan = clamp(dx / 60, -1, 1) relative to the listener. Turbo: +15% freq, add a high whine oscillator. Wrecked: engine stops with a 0.3 s pitch drop.
- **Gun**: per shot, 40 ms noise burst through a bandpass 1800 Hz (Q 1.2) + 30 ms square click at 140 Hz, gain 0.18 (player) / scaled by distance. Limit to 1 voice per car at a time (retrigger).
- **Overheat**: 0.4 s descending sine sweep 900 -> 300 Hz + hiss.
- **Explosion**: 1.2 s brown-ish noise (lowpass sweeping 2000 -> 200 Hz) + 60 Hz sine thump 0.25 s, gain 0.6, distance-scaled; wrecks louder (0.8) than mines (0.55).
- **Impact**: 80 ms noise through lowpass 600 Hz + metallic ring (2 detuned triangles 380/523 Hz, 0.15 s decay), gain proportional to `min(1, speed / 25)`.
- **Mine**: beep 1400 Hz 40 ms every 0.5 s when armed and within 20 m of the listener (max 3 beeping mines).
- **Pickup**: arpeggio of 3 sine notes (cash: C6-E6-G6, repair: G5-C6, mines: E5-E5, turbo: rising sweep), 60 ms each.
- **Countdown**: 3, 2, 1 = 600 Hz sine 0.15 s; raceStart = 1200 Hz 0.4 s.
- **Skid**: bandpass noise 900 Hz, gain `min(1, lateralSpeed / 10) * 0.12` (estimate lateral speed from `drifting` flag and speed: 0.12 when drifting, ramp 80 ms).
- **UI**: move = 30 ms 900 Hz tick, confirm = 2-note up, back = 2-note down, buy = cash register-ish noise + 2 notes, error = 120 Hz buzz 0.15 s.

Rules:
- Total live voices <= 48; one-shots beyond that are dropped (oldest first). Pre-create engine and skid voices for all cars on the first `update`, never per frame.
- `unlock()` resumes the context; before unlock everything is a no-op (no errors).
- `setVolumes` applies with a 50 ms ramp. `stopRace()` ramps race buses to 0 in 100 ms and stops engine/skid voices.
- No `setInterval`; schedule with `AudioContext.currentTime`.

Acceptance tests (audio):
- [ ] `npm test -- audio` -> pure functions tested: `engineFrequency(rpm01)` continuous within each gear and in the 55-200 Hz range; distance falloff; voice limiter keeps <= 48.
- [ ] `?harness=audio`: every button plays without console errors after one click (unlock). Report lists each sound with a one-line description of how it sounds.
- [ ] Fake race toggle: voice count stays <= 48 over 60 s (readout in `__harness.voices()`).

## Allowed deferrals
None.

## Out of scope
Music, sample files, spatial HRTF, rebinding, touch input.
