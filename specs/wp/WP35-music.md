# WP35 - Background music: 6 race tracks, 1 menu track, music volume (CCR-11)

**User requests (2026-10-27), verbatim:** "also find some background music like death rally during races", then after the shortlist: "Use the top 6 race tracks plus Hyperton for menus; spec and dispatch the music WP.", and "I want the music to be in the background as a support not too loud". The user approved downloading the 7 files below.

Read first: `SPEC.md` (sections 7-8: audio, budgets), `specs/contracts.ts` (AudioEngine, Settings), `src/audio/{index,bus,mix,samples}.ts` and tests, `scripts/sfx/importSfx.mjs` and `importEngines.mjs` (ffmpeg pipeline, BS.1770 loudness), `docs/sfx-sources.md`, `src/game/settings.ts` (+test), `src/game/index.ts` (screen flow), `src/ui/screens/Settings.tsx`, README "Credits".
Owns: `src/audio/**`, `scripts/sfx/importMusic.mjs` (new), `public/music/**` (new), `docs/sfx-sources.md` (a "## Music" section), `src/game/settings.ts` (+test), the music hook-up lines in `src/game/index.ts`, `src/ui/screens/Settings.tsx` and `src/ui/fixtures.ts` (the new slider only), README "Credits" (one line), both contracts copies for CCR-11 only. Nothing else.
Dispatch: subagent (opus, effort high). Branch `wp/35-music`, worktree `../wreckline-wt/wp35`, dev port 5235 (launch entry `wreckline-wp35`).

## Tracks (all CC0, licence checked by the brain on each page 2026-10-27)

| id | title | artist | page | use |
|---|---|---|---|---|
| darknessRoad | Darkness Road (the normal version, not "Climax") | MintoDog | https://opengameart.org/content/darkness-road | race |
| systemOverload | system_overload (T & T Free Cyberpunk Pack 2) | Alexander Ehlers (tricksntraps) | https://opengameart.org/node/119238 | race |
| hotRoadway | Hot Roadway (normal version) | MintoDog | https://opengameart.org/content/hot-roadway | race |
| awake | Awake! (Megawall-10) | cynicmusic | https://opengameart.org/content/awake-megawall-10 | race |
| glutton | Glutton | Kistol | https://opengameart.org/content/glutton | race |
| hyperflight | Hyperflight Racing | cynicmusic | https://opengameart.org/content/hyperflight-racing | race; the artist says the energy drops: trim to the high-energy part and loop that |
| hyperton | Hyperton | Sudocolon | https://opengameart.org/content/hyperton | menu |

Download only these files from those pages (into `../wreckline-wt/wp35-tmp/music-src/`, never into the repo), re-check the licence line on each page as you download, and record the page URL, file name, licence and download date in `docs/sfx-sources.md` "## Music". If a page's licence is not CC0 any more, skip that track and report it.

## 1. Import (`scripts/sfx/importMusic.mjs`)
- ffmpeg to `public/music/<id>.ogg` (Opus or Vorbis, about 96 kbps stereo; also `.m4a` AAC only if Safari cannot play the chosen codec, check and report) with a seamless loop: pick loop points on a bar boundary, crossfade-free (sample-accurate `loopStart`/`loopEnd` in a manifest `public/music/manifest.json`, like the engine manifest), or trim so the file loops end to start without a click.
- Loudness: measure each track's integrated loudness with the same BS.1770 code as importSfx and normalise every track to the same target, so no track is louder than another. **"Background as support, not too loud":** at default settings the music must sit clearly under the race sound: target integrated loudness of the music after the music gain at least 10 LU below the measured race SFX mix (engines + skids + gunfire in a typical race moment; measure it, say how) and the menu track a little quieter still. Report the numbers.
- Total size of `public/music/` reported (about 2-3 MB per race track is expected). Music is streamed from `public/`, outside the `dist/assets` bundle budget; check `npm run build` still reports the same budget figure.

## 2. Playback (`src/audio`)
- A music bus: `music gain -> master` (not through `sfx`), named constants in `mix.ts` (`MIX.bus.music`). Music fades in 1.5 s and out 0.8 s, never cuts.
- Race: one race track per race, picked from the race seed so a replayed seed hears the same track and two races in a row never repeat the same track (cycle or shuffle-bag). Starts at the countdown, keeps playing through the race, fades out on the results screen, pauses (gain to 0 or suspend) on the pause screen and resumes.
- Menus (title, settings, career hub, garage, shop, quick race setup, results after the fade, future story scenes): the menu track loops. Switching race <-> menu cross-fades.
- Lazy loading: fetch a track only when it is about to play (the menu track on audio unlock, a race track when the race setup is built); a missing or failed file means silence, never an error on screen or a blocked race.
- Mute when the tab is hidden, like the existing race sounds (check what the engine does now and match it).

## 3. CCR-11 (pre-approved by the brain; apply in both contracts copies)
- `Settings.musicVolume: number; // 0..1, default 0.5 (CCR-11)`. Settings migration in `src/game/settings.ts`: a stored settings object without it gets the default; test it.
- `AudioEngine.setVolumes(master: number, sfx: number, music: number): void` and `AudioEngine.setMusic(mode: 'off' | 'menu' | 'race', seed?: number): void` (or the smallest equivalent you justify). Update every caller and fake.
- Settings screen: a MUSIC slider under SFX, same style and step, applied live.

## Acceptance tests
- [ ] Unit: settings migration default; race track pick deterministic per seed and no back-to-back repeat; loop manifest values inside each file's length; music gain chain (music bus not under sfx; master scales it).
- [ ] Import: per track the measured loudness before/after, loop points, file size; the race SFX mix measurement and the margin (>= 10 LU at default volume).
- [ ] Browser (your dev server): title -> menu track plays after the first key press; quick race -> race track at the countdown, cross-fade, pause silences it, results fades it; settings MUSIC slider at 0 silences music only; no console errors. Two 1280x720 screenshots are not needed; instead report what `__game`/the audio debug API shows (which track, gain values) at each step.
- [ ] Listen-check is the user's job: say exactly where to listen (URL and steps).
- [ ] `npm run verify` green; bundle budget figure unchanged.

## Out of scope
Story scenes (the menu track will simply keep playing there once they exist), final-lap "Climax" variants, per-track or per-tier music choice, engine sounds, SFX levels.
