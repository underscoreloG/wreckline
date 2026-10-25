# WP26 - Headlight beams and boost feel

**User feedback (2026-10-25, verbatim):** "Car lights are kind of weird with 2 layers. small and big cone" and "Car speed boost, I would like the shinny things to be less visible and a better sensation of speed". Choices from the grill: two soft beams, dark themes only; boost feel from all four of camera kick, screen-edge motion, road-level particles, exhaust flame.
Read first: `specs/design.md` (sections 1-3: readability from 55 m up, effects, quality levels), the WP17 entry in `docs/tuning-log.md` (why streaks exist), then `src/render/{fx,camera,post,particles,textures}.ts` and their tests, `src/render/themes/*.ts` (read only).
Owns: `src/render/fx.ts`, `src/render/camera.ts` (+ `camera.test.ts`), `src/render/post.ts`, `src/render/particles.ts`, new test files for them, `docs/tuning-log.md` (append an entry). Not `src/render/{index,carMesh,harness}.ts` (WP14 is running) nor `trackMesh`, `textures`, `props`, `scene`, `themes` (WP27). Anything else needs a CCR.
Dispatch: subagent (opus, effort high). The user judges the feel after the merge.

## Headlights
- Today `headlightGeometry()` in `fx.ts` draws two stacked triangles (a 14 m faint cone and a brighter 7 m one): that is the "2 layers". Replace with **two soft beams per car**, one from each lamp (about +-0.3 x car width from the centre line at the nose), each a smooth fade in length and width with no visible inner shape or hard edge; still one instanced draw for all cars.
- Shown only on dark themes: `scrapyard` (dusk), `docks`, `snow`, `city`. Off on `desert` and `quarry` (this also closes the old "desert headlights in daylight" ledger note). Fx already gets `track.def.theme`; keep the theme list in `fx.ts`.
- Keep the quality gate (high only) and the wrecked-car cut.

## Boost
- **Less shine:** the white HDR streaks (`STREAK_GLOW` 2.2) and the glow particles behind the exhaust go. Nothing the boost adds may reach bloom except the flame core.
- **Exhaust flame:** a short flickering flame at `parts.exhaust` for every car with turbo active: hot core to orange tip, length jitter, no glitter particles.
- **Camera kick (player):** on the player's `turboStart`, a quick zoom-out pulse (out in ~0.15 s, settles to a held boost offset while turbo lasts, back on turbo end) and a light shake. The shake obeys the existing "camera shake" setting; the zoom does not.
- **Screen-edge motion (player, high quality):** a radial/zoom blur or streak effect in the post stack, masked to the screen edges (centre ~50% sharp), strength following speed while boosting, fading in and out over ~0.2 s. Off on low quality.
- **Road-level particles (player):** small ground-level particles whipping backwards past the car while boosting, colour from the theme (dust on desert/quarry/scrapyard, spray on city, snow on snow, grit on docks), low alpha, no bloom.

## Acceptance tests
- [ ] Unit tests: beam geometry has no interior second layer (one fade per beam), theme gate on/off per theme, camera kick envelope (peaks within 0.2 s, returns to rest after turbo end), shake is zero with the setting off.
- [ ] Browser (dev server on port 5226): a race on Scrapyard (dark) and Dust Bowl (day) with turbo: screenshots before/after of headlights and of a boost, saved outside the repo for the brain; no console errors.
- [ ] Draw calls: race with 4 cars at high quality grows by at most 3 versus main; report the numbers and fps as measured.
- [ ] Low quality: no beams, no edge effect, boost still has flame and camera zoom.
- [ ] `npm run verify` green; bundle growth reported.

## Out of scope
Track dressing (WP27), car models (WP14), sound.
