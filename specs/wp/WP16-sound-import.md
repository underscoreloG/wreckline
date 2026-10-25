# WP16 - Sound import and mix

**Wave C2 (after WP15U), parallel with WP10 and WP14.** Goal: the recorded sounds in the game, consistent in loudness and length, with the synth as fallback, and a mix the user signed off by ear.
Read first: `SPEC.md`, `specs/contracts.ts` (AudioEngine, UiSound, SimEvent), `specs/wp/WP05-input-audio.md`, `specs/sfx/list.md`, `src/audio/**` (WP05's engine: bus, voices, sfx recipes, harness).
Depends on: WP05 merged, WP15U done (`art-incoming/sfx/` filled; the brain copies it into your worktree, it is gitignored).
Owns: `src/audio/**`, `scripts/sfx/**`, `public/sfx/**`, `docs/sfx-sources.md`. Nobody else writes these paths in C2. Anything else needs a CCR.
Tooling: `ffmpeg` / `ffprobe` from Homebrew (`/opt/homebrew/bin`), used only by the import script on the dev machine. The processed files are committed, so CI and the build never need ffmpeg. No new npm dependency.

## Deliverables
- `scripts/sfx/importSfx.mjs`: for each row of `art-incoming/sfx/sources.csv`: trim leading/trailing silence (below -50 dBFS), cut to the target length from `specs/sfx/list.md` with a 10 ms fade-out, convert to mono unless the list says stereo, normalise loudness per category (one-shots: peak -3 dBFS and short-term loudness matched within +-2 LU inside each category: combat, pickups, UI; loops: seamless crossfade of 50 ms), encode to `public/sfx/<name>.mp3` (44.1 kHz, 128 kbps; MP3 plays in every target browser). Prints a table: name, source duration, output duration, peak, loudness, file size. Exits 1 on a missing file, a licence other than the Pixabay Content License without an explicit note, or a total over 1.5 MB.
- `docs/sfx-sources.md`: generated from `sources.csv` (name, title, URL, licence), the project's record of where every sound came from.
- `src/audio/samples.ts`: `loadSamples(ctx): Promise<void>` (fetch + `decodeAudioData`, all in parallel after unlock, failures logged and left to the fallback), `hasSample(name)`, `playSample(ctx, dest, name, t0, gain, pan, rate?)` returning the same `Voice` shape as `playSfx`.
- `src/audio/sfx.ts` / `index.ts`: every `SfxName` plays its sample when loaded, else the existing synth recipe; small random pitch variation (+-4%) on repeated combat sounds so rapid fire does not sound robotic. Add the new names `lapCompleted`, `carDamaged` (player only, rate-limited to 1 per 0.25 s) and `mineDropped`, wired to their SimEvents. `engine` and `engineTurbo` stay synth.
- Mix: one gain table (`MIX` in `src/audio/mix.ts`) per sound and per bus, the only place levels live. Starting point from WP05's note: raise `gun` about 6-8 dB relative to the engine.

## Acceptance tests
- [ ] `node scripts/sfx/importSfx.mjs` prints the table with every sound within its target length and loudness band, total `public/sfx` <= 1.5 MB.
- [ ] `npm test -- audio`: sample fallback (a failed fetch plays the synth recipe), rate limit on `carDamaged`, pitch variation stays within +-4%, `MIX` covers every `SfxName`.
- [ ] Audio harness (`?harness=audio`): each button plays the sample (harness shows "sample" or "synth" per sound), and the offline check from WP05 still reports every sound audible with peak <= 0 dBFS.
- [ ] `npm run verify` green; the JS bundle budget is unaffected (`public/sfx` is outside `dist/assets`).
- [ ] **Listening session** (the brain runs it as a `session`-style step with the user after merge, not the worker): the user plays 2 races with sound on and answers per category (combat, pickups, UI, engine vs effects balance) "too quiet / ok / too loud"; changes go only into `MIX`, logged in `docs/tuning-log.md`.

## Out of scope
Music, voice lines, the engine sound, spatial reverb, recording new sounds.
