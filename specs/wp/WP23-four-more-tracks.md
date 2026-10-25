# WP23a / WP23b - Four more tracks

**Wave C2, after WP22 merges, WP23a and WP23b in parallel.** Same decisions as WP22. WP23a builds Junkyard Sprint and Pine Hollow; WP23b builds Rain District and Blast Pit (content.md section 12 list, tracks 7-10).
Read first: `specs/content.md` section 12, `specs/design.md` section 1, `specs/wp/WP22-themes-and-showcase-tracks.md` and its report, then `src/content/tracks/**` (WP11 and WP22 tracks as examples), `src/render/themes/**`, `src/sim/soak.ts`.
Owns: WP23a: `src/content/tracks/{junkyardSprint,pineHollow}.ts` and `src/content/tracks/wp23a.test.ts`; WP23b: `src/content/tracks/{rainDistrict,blastPit}.ts` and `src/content/tracks/wp23b.test.ts`. Registration in `src/content/tracks/index.ts` is done by the brain at merge (two parallel writers would conflict): each report gives the exact import and registry lines. Anything else needs a CCR.
Dispatch: subagent (opus, effort high) each.

## Deliverables (per worker, two tracks)
- Track defs with the listed signature, header comment with the corner list, pickups at tuning-pass-1 density, `referenceLapTime` from the 16-seed soak median, using the existing themes and props only.
- Tests: validateTrack, placeProps stable, pickup rules, soak 16 seeds per track (import the track directly, not through TRACKS).

## Acceptance tests
- [ ] `npm test` for your test file: all pass; report length, minRadius, minClearance, pickups, referenceLapTime, wall impacts and wrecks per race per track.
- [ ] Browser (`preview_start` on your own launch entry): register the tracks locally only for the check (do not commit index.ts), `?race=1&track=<id>&autoplay=1&autopause=0`, one screenshot per track, `drawCalls < 150`, no console errors.
- [ ] `npm run verify` green.

## Out of scope
New themes or props (WP22), UI.
