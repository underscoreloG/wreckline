# WP28 - Recorded engines for BLAZE, ICEBERG and TITAN

**User feedback (2026-10-26):** the WP25 synth engines sound synthetic; the user wants real recordings. Sources safe for a public repo exist for 3 cars only (CC0 on Freesound, licences checked by the brain on each page); the other 5 cars keep their WP25 synth profile until the user finds sounds, and this WP must make adding a car later a data change (files + one table row).
Read first: `specs/wp/WP25-engine-voices.md`, `specs/wp/WP16-sound-import.md`, `docs/sfx-sources.md`, then `src/audio/{engine,engineProfiles,bench,benchPanel,index,mix,harness,measure}.ts` and their tests, `scripts/sfx/importSfx.mjs`, `art-incoming/engines/sources.csv`.
Owns: new `scripts/sfx/importEngines.mjs`, `public/sfx/engines/**` (new), `src/audio/**`, `docs/sfx-sources.md` (an engines section), `docs/tuning-log.md` (append). No contract change (`setRaceCars` from CCR-9 already gives the car type). Anything else needs a CCR.
Dispatch: subagent (opus, effort high). The user judges by ear after the merge (harness A/B per car).

## Inputs (gitignored, the brain copies them into the worktree)
`art-incoming/engines/<car>/<slot>.mp3`, Freesound HQ previews (128 kbps MP3), all CC0 1.0, one row each in `sources.csv` (id, author, page, preview URL):
- blaze: Mercedes 190E-16V dyno (Chippy569, pack 9658): `500_on`, `2500_on`, `6500_on`, `500_off`, `2500_off`, `6500_off`. "on" = full load, "off" = zero load, from the take numbers (19/20 full, 21 zero); the pages do not state the load, so check by ear-proxy (level and spectrum: full load is louder and brighter) and report.
- iceberg: BMW 120d diesel, outside mic (GiocoSound, pack 22622): `idle`, `low`, `mid`, `high`. One load only.
- titan: city bus diesel (Mihacappy, pack 43418): `idle`, `low`, `mid` (~2000 rpm per the page). One load only; above `mid` the loop is pitched up.

## Import script (`scripts/sfx/importEngines.mjs`, dev machine, Homebrew ffmpeg like `importSfx.mjs`)
- Per file: decode to mono 44.1 kHz, pick the steadiest window (lowest level and pitch variance), cut a loop of 1-3 s with a short crossfade of the tail into the head, encode to `public/sfx/engines/<car>/<slot>.mp3`.
- MP3 adds encoder padding: write `public/sfx/engines/manifest.json` with, per car, each step's nominal rpm, load, and `loopStart`/`loopEnd` in seconds measured on the decoded output, so the player loops sample-exact (`AudioBufferSourceNode.loopStart/loopEnd`).
- Nominal rpm per step: estimate from the firing frequency (4-stroke: f = rpm / 60 * cylinders / 2; 190E and 120d are 4-cylinder, the bus engine is a 6-cylinder: say if the spectrum disagrees) and report the estimate next to any value the page states.
- Loudness: match each car's set to the WP25 engine level (`MIX.engine`), steps matched to each other within 2 dB; peaks at or under -3 dBFS.
- Prints a table: car, slot, source length, loop length, rpm estimate, loudness, seam jump (largest sample step across the loop point, decoded), file kB. Exits 1 if a seam jump is over 3x the median step of the loop or the total `public/sfx/engines` is over 1 MB.

## In the game
- A sample engine voice built from the bench math (`bench.ts`, generalised from the fixed Mercedes slots to any step list from the manifest): equal-power crossfade between the two nearest rpm steps, between on/off load by throttle when a set has both, and `playbackRate` so pitch follows rpm inside a band. rpm01 maps to each car's step range (idle step to top step, then a capped pitch-up above the top step: at most x1.5).
- A car uses its recorded set when the manifest lists it and its files loaded; otherwise its WP25 synth profile (load failure falls back, logged once). The other 5 cars are unchanged.
- Turbo keeps a pitch lift and the WP25 whine layer on top; wreck keeps the pitch drop and fade.
- Cost: only the steps with a non-zero gain play (start/stop sources as rpm moves, with short fades), at most 4 sources per recorded engine; the voice cap still holds with 8 cars.
- Harness: per car, a "recorded / synth" switch next to the sweep button, loudness-matched; the WP25 Mercedes bench may become this or be removed if redundant (say which).
- `docs/sfx-sources.md`: an engines section listing every file with author, Freesound page, CC0 1.0.

## Acceptance tests
- [ ] `node scripts/sfx/importEngines.mjs` prints the table, exit 0; seams under the threshold; total <= 1 MB.
- [ ] Unit tests: generalised crossfade (any step count, one or two loads, equal power, gains only on the two steps around rpm), rpm01 to step mapping with the pitch cap, recorded-or-synth choice per car, fallback when a file fails.
- [ ] Offline render per recorded car at rpm01 0.2 / 0.5 / 0.8 with throttle: peak <= 0 dBFS, RMS within +-3 dB of raven's synth at 0.5; no clicks at the loop point (report the seam metric on the render).
- [ ] Browser (dev server on port 5228): harness A/B for the 3 cars and a race with blaze, iceberg, titan and raven: no console errors, voice count within the cap.
- [ ] `npm run verify` green; report bundle and `public/sfx/engines` sizes.

## Out of scope
The other 5 cars (no safe source yet), any non-CC0 file, other sounds or MIX levels other than `engine`.
