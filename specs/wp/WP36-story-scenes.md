# WP36 - Career story scenes (CCR-12)

**User requests (2026-10-27), verbatim:** "when in career, would it be possible to add some story? Like we should have an endgoal and each race we have some kind of frame with people and stuff behind (related to the race track or whatever) and some kind of conversation going ... and then space to continue. I don't want any voice, just a frame with some text below like the old game." Then, after generating the art in Gemini: "Keep all 16 images as they are; spec the story scenes WP and dispatch it once the music WP is merged."

Read first: `SPEC.md`, **`specs/story.md` (the story bible: every line, trigger, stage rule and UI rule; it is the source of truth for text)**, `specs/contracts.ts` (SaveGame, Screen, RaceOffer), `src/meta/career.ts` (`rankOf`, `generateOffers`, `applyRaceResult`), `src/meta/save.ts` (+tests, migrations), `src/game/index.ts` and `src/game/store.ts` (screen flow: raceSelect -> preRace -> race -> results, champion), `src/ui/screens/PreRace.tsx`, `src/ui/screens/career/*`, `src/ui/fixtures.ts`, `src/content/rivals.ts`, the music hook-up WP35 added (`setMusic`), `specs/design.md` (UI tokens, fonts).
Owns: `src/content/story.ts` (new: all lines and scene data), `src/meta/story.ts` (new: pure scene picking) + test, `src/ui/screens/career/StoryScene.tsx` (new) + any small UI test, the story hook-up in `src/game/index.ts` / `src/game/store.ts`, `src/meta/save.ts` + `src/meta/career.ts` (the CCR-12 fields only), `scripts/assets/importStory.mjs` (new), `public/story/**` (new), both contracts copies (CCR-12 only), `specs/story.md` (only to correct a line that cannot work, say which).
Dispatch: subagent (opus, effort high), after WP35 (music) is merged. Branch `wp/36-story`, worktree `../wreckline-wt/wp36`, dev port 5236 (launch entry `wreckline-wp36`).

## 1. Images (`scripts/assets/importStory.mjs`)
Source: `/Users/kevin/Downloads/Claude/wreckline/story-art/<id>.jpg` (16 files: `beat-intro`, `beat-vex`, `beat-razor`, `beat-duchess`, `beat-warden`, `beat-ending`, and the 10 track ids; ignore `cast-sheet.jpg` and `_overview-*.jpg`; the folder is git-ignored, read it from the main checkout path). Output `public/story/<id>.webp`, 1600x900 (centre crop to 16:9 from 2752x1536), quality chosen so each is about 150-250 kB; use `sharp` (in node_modules) or `cwebp` (/opt/homebrew/bin). The user kept all 16 as they are: no retouching. Report the total size.

## 2. CCR-12 (pre-approved by the brain; apply in both contracts copies)
- `Screen` gains `'story'`.
- `SaveGame` version 4: `storySeen: string[]` (scene ids already played: beats and `boss-lost-<n>`) and `bossLosses: number` (boss races raced and not won). Migration v1-v3 -> v4: `storySeen` = the beats a save at that rank has already passed (so a mid-career save does not replay old beats: every beat whose trigger is already behind it, never `beat-ending` unless `championWon`), `bossLosses` 0. Test each migration.
- `applyRaceResult` increments `bossLosses` after a boss race that the player did not win. Nothing else in the economy changes.
- If you need a smaller or different shape, justify it in the report.

## 3. Scene picking (`src/meta/story.ts`, pure, no RNG)
`storySceneFor(save, offer): StoryScene` and `endingScene(save): StoryScene | null`, where a scene = `{ id, image, lines: { speaker, text }[] }`. Rules from `specs/story.md` sections 3-4:
- Order of precedence before a race: the first unplayed beat whose trigger holds (`beat-intro` first race; `beat-vex` rank <= 15; `beat-razor` <= 10; `beat-duchess` <= 5; `beat-warden` when the offer list has the boss race, i.e. rank 1); else an unplayed boss-lost scene (`bossLosses` > number of `boss-lost-*` in `storySeen`: the beat-warden image with the "Boss lost" lines); else the track scene for `offer.trackId`.
- Several beats due at once (a big jump in rank): play only the highest one and mark the skipped lower ones as seen.
- Track scene lines: the track line (rotating over visits by `racesRun`), the stage line (stage from rank, rotating by `racesRun`), then the lieutenant line if VEX/RAZOR/DUCHESS/BANSHEE is in `offer.rivals` (the highest-ranked one if several; THE WARDEN's lines in the boss race), else a second track line. Deterministic: the same save and offer always give the same scene.
- `endingScene`: `beat-ending` after the boss race is won, played before the champion screen.
- Marking a scene as seen happens when it is shown (the save is written then), so quitting after the scene does not replay a beat.
- Unit tests: every trigger, the precedence, the skip-lower-beats rule, boss-lost once per loss, determinism, the lieutenant pick, migration seeding.

## 4. Scene screen (`StoryScene.tsx`) and flow
- Career only: after the player confirms on the pre-race screen, show the scene, then start the race. After a won boss race: ending scene, then the champion screen. Quick race never shows scenes.
- Layout as `specs/story.md` section 5: the image on top (16:9, letterboxed, scaled to fit, `image-rendering: pixelated` is not needed at 1600 px, smooth is fine), a dark text panel below, speaker name in its colour, the line typing out at about 40 characters per second.
- SPACE / Enter / click / gamepad confirm: finish the current line, then next line; after the last line a "SPACE to race" (or "SPACE to continue" for the ending) prompt; ESC / gamepad back skips the whole scene. No forced wait. Uses the existing input nav (`UiNav` confirm/back).
- Image loads lazily; if it is missing or still loading, the panel shows on a dark background and the text works anyway.
- Music: the menu track keeps playing during scenes (WP35's menu mode); the race track starts at the countdown as before.
- Fonts and colours from `specs/design.md`; speaker colours from `specs/story.md` section 5.

## Acceptance tests
- [ ] Unit tests of section 3 and the CCR-12 migrations; existing career, save and UI tests green with unchanged intent.
- [ ] Browser (your dev server), screenshots 1280x720 into `../wreckline-wt/wp36-shots/`: a new career's first race shows `beat-intro` (screenshot mid-typing and at the last line); a save at rank 15 shows `beat-vex`; a normal track scene with a lieutenant line (set up a save so VEX is in the offer); ESC skips straight to the race; the race starts normally after the scene; no console errors. Use the dev `__game` API or a crafted save in localStorage to reach each state; say how.
- [ ] Image import: 16 files, sizes, total.
- [ ] `npm run verify` green; bundle budget figure reported (story text is small; images live in `public/`).

## Out of scope
New story text beyond `specs/story.md`, voice or SFX per line, animated scenes, quick race scenes, rewriting the economy.
