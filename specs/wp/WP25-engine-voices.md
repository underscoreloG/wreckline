# WP25 - Engine voice per car, and a recorded-engine test bench

**User request (2026-10-25):** each car should have its own engine sound. A Pixabay search and a Freesound CC0 search found matched rev-band loop sets only for 4-cylinder and diesel engines (none for V8, V10/V12, rotary or supercharged), so every car gets its own **synth** profile now, and the audio harness gets a small test bench that plays a recorded rev-band set (the CC0 Mercedes 190E-16V dyno pack the user downloads) against BLAZE's synth profile, so the user can judge recorded vs synth by ear before anything recorded is imported.
Read first: `specs/wp/WP05-input-audio.md` (engine recipe, voice budget), `specs/wp/WP16-sound-import.md` (MIX table, harness), `specs/content.md` section 1 (roster), then `src/audio/{engine,index,mix,harness,bus,voices}.ts` and their tests, `src/game/raceSession.ts`.
Owns: `src/audio/**` (new files allowed, for example `src/audio/engineProfiles.ts`), the CCR-9 lines in `specs/contracts.ts` and `src/shared/contracts.ts` (both copies identical), the one call site for CCR-9 in `src/game/` (where the race setup is known; keep it to the call), `docs/tuning-log.md` (append an entry). Anything else needs a CCR.
Dispatch: subagent (opus, effort high).

## CCR-9 (apply in this WP)
The snapshot carries no car type, and audio rpm uses the starter car's maxSpeed for every car (WP05 note). Add to `AudioEngine`:
```ts
/** Called when a race setup is built, before the first update of that race. Index === CarId. maxSpeed is the effective stat (upgrades included). */
setRaceCars(cars: readonly { carDefId: string; maxSpeed: number }[]): void;
```
The game calls it with the entrants of every race it starts (quick race, career, title backdrop). Until it is called (audio harness fake race, tests), every car uses the `raven` profile and the starter's maxSpeed, as today. `rpm01 = |speed| / that car's maxSpeed`.

## Profiles
One profile per car in the car registry, keyed by `carDefId`, derived from the registry in tests (never pin the list). Same voice structure for every car, different numbers; add only the layers the targets below need. Targets (by ear, the user judges):

| car | character |
|---|---|
| raven | V8 muscle burble: low, lumpy idle, thick mid |
| outlaw | small rough engine: higher, buzzy, uneven idle wobble |
| iceberg | big diesel SUV: low, clattery, low top end |
| scorch | big-block hot rod: lowest and loudest burble, strong rumble |
| blaze | high-revving sports four: brighter, revs high, thin bottom |
| titan | big diesel truck: lowest pitch, heavy, slow rev |
| viper | V10/V12 supercar scream: smooth (top end under blaze since the 2026-10-26 listening session, see docs/tuning-log.md) |
| wraith | supercharged V8: raven-like base plus an rpm-tracking supercharger whine, always on |

Likely layers (worker's choice): pitch range and gear sweep per car, harmonic mix, lowpass base/throttle, a filtered-noise exhaust layer (one shared noise buffer), slow pitch/amp wobble for lumpy idles. Turbo keeps today's pitch lift and whine on top. Wreck keeps today's pitch drop.

Mix rule: at the same rpm01 and throttle, every profile's loudness (offline RMS) sits within +-3 dB of raven's, so `MIX.engine` levels stay valid; peak <= 0 dBFS. Voice and node cost per car stays within 2x today's (8 cars race in the title backdrop).

## Test bench (audio harness only, no game code, no files in the repo)
- In `?harness=audio`: a button per car that plays a 4 s rev sweep (idle -> max -> idle, throttle on the way up) with that car's profile, and the offline level check extended to one line per profile.
- A "recorded set" panel: a file picker (`<input type=file multiple>`) where the user picks local WAVs from the Mercedes 190E pack (Chippy569, freesound.org pack 9658, CC0): rpm steps 500 / 2500 / 6500, each FULL load and ZERO load. Map files by the rpm and load in the filename (`<nn>_<rpm>_<mic>.wav` naming, load from the file name if present, else let the user assign each file to a slot in a small table). Play them as looping sources with an equal-power crossfade across rpm steps and between on-load / off-load by throttle, with playbackRate scaling inside each band so pitch follows rpm.
- Controls: rpm slider, throttle toggle, the same 4 s auto sweep, and an A/B switch to BLAZE's synth profile at the same rpm and throttle, loudness-matched by a gain trim the user can nudge.
- Missing files: the panel says which slots are empty and plays what it has; nothing breaks without files.

## Acceptance tests
- [ ] CCR-9 applied in both contract copies; the game passes the entrants for every race; a test shows a non-raven car gets its own profile and its own maxSpeed in rpm01.
- [ ] Every registered car has a profile (test derived from the registry); offline render per profile: audible, peak <= 0 dBFS, RMS within +-3 dB of raven at rpm01 0.5 with throttle.
- [ ] Profiles differ measurably: report each profile's fundamental and spectral centroid at rpm01 0.2 and 0.8 (table in the report and the tuning log); no two cars within 5% on both.
- [ ] Harness: per-car sweep buttons and the recorded-set bench work in the browser with no console errors; the bench handles 0 to 6 files (test the crossfade math in a unit test with fake buffers).
- [ ] A race in the dev server with 4 different cars: no console errors, voice count within the cap.
- [ ] `npm run verify` green; bundle growth reported.

## Out of scope
Importing any recorded engine into the game, new dependencies, changes to other sounds or MIX levels other than `engine`.
