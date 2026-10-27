# WP39 - Reversed tracks (CCR-14)

**User request (2026-10-27):** see WP38 (top 3 from the genre comparison). Choice (user): "Quick race, trial and career": a REVERSE toggle in quick race and time trial; career offers sometimes use the reversed layout (deterministic), so careers see more variety. Why (genre research): track repetition is a common single-player complaint; reversing doubles the layouts from 10 to 20.

Depends on: WP38 merged. Read first: `SPEC.md`, `specs/contracts.ts` (TrackDef, RaceSetup, RaceOffer, Settings), `specs/content.md` section 12 (tight rules), `src/shared/trackGeometry.ts`, `src/content/tracks/**` (index, roundedLoop, placeProps, trackTestKit, shape.test, a few track files), `src/sim/racingLine.ts`, `src/sim/soak.ts`, `src/render` track dressing (start grid, kerbs, direction-dependent props such as grandstands and the start line), `src/meta/career.ts` (`makeOffer`), `src/meta/story.ts` (track scenes use `offer.trackId`), `src/ui/screens/PreRace.tsx`, `src/ui/screens/career/RaceSelect.tsx`.
Owns: a reverse builder in `src/content/tracks/` (new file) + test, `src/content/tracks/index.ts` (registry access to reversed variants), `src/shared/trackGeometry.ts` (only if a helper is needed), the reversed `referenceLapTime` table, `src/meta/career.ts` (offer direction), `src/meta/story.ts` (only so reversed offers keep their track scene), the quick race and career UI bits that show or toggle direction (`PreRace.tsx`, `RaceSelect.tsx`, fixtures), the settings line for the remembered toggle, render dressing only where it depends on direction, both contracts copies (CCR-14 only), `scripts/balance/**` (cover reversed layouts), `specs/content.md` section 12, `docs/tuning-log.md`.
Dispatch: subagent (opus, effort high). Branch `wp/39-reverse`, worktree `../wreckline-wt/wp39`, dev port 5239.

## Change
- A reversed variant of each track built from its def at load (no hand-drawn copies): centreline in the opposite order, pickups and props mirrored in s, checkpoints rebuilt. **The start/finish line and grid must sit on a straight in the new direction**: the original start straight leads into T1, so reversed, the grid would sit in the last bend; move the reversed start to the far end of the original start straight (or any straight >= the grid length) and say what you chose per track.
- Each reversed variant passes the same rules as its forward track (`validateTrack`, the tight shape rules, soak gates: wrecks 0.2-2.0, 0 timeouts, nobody stuck) and has its own measured `referenceLapTime` (0.55 median clean lap, as WP37). If a reversed layout fails a gate, fix it with the start position or pickup placement, not by redrawing the track; report any that cannot pass.
- CCR-14 (pre-approved, smallest shape that works, justify changes): a way to name a direction everywhere a track is chosen: `RaceOffer.reversed: boolean`, `Settings.quickReversed: boolean` (default false), and the race setup carries the reversed TrackDef (id like `scrapyard~r`, name "Scrapyard Reverse" or a REV badge in the UI). Save files: offers are rebuilt on load, so no save migration should be needed; confirm.
- Career: an offer is reversed by a deterministic rule from `racesRun` and the tier (about one offer in three; never all three in one round). Story track scenes use the base track's image and lines.
- Quick race (and later time trial): a REVERSE toggle next to the track picker, remembered.
- Balance: `run.mjs` covers the 10 reversed layouts too (as extra track rows, or a flag), and the all-track rows stay in target.

## Acceptance tests
- [ ] Unit: reversed geometry (length equal, heading opposite, checkpoints in order), pickups mirrored, start on a straight, determinism of the career rule and no round with three reversed offers.
- [ ] Per reversed track: shape numbers, start position, referenceLapTime, soak gates.
- [ ] `run.mjs` with reversed rows: report; all-track rows in target.
- [ ] Browser: a quick race on Scrapyard Reverse and Neon Mile Reverse with 7 AI and `autoplay=1` runs 3 laps; screenshots (1280x720) of the reversed start grid and a race moment into `../wreckline-wt/wp39-shots/`; a career offer shows the reverse badge; no console errors.
- [ ] `npm run verify` green.

## Out of scope
New track art or themes, mirrored (left-right flipped) layouts, track editor.
