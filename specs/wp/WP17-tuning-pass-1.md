# WP17 - M1 tuning pass 1 (faster, more pickups)

**Phase 5, before the fun gate counts.** The user played M1 v0.2.0: "seems to be working great, it is a little bit too slow in my opinion. And I would love a little bit more bonuses on the race." They chose: faster cars plus a stronger sense of speed, and more of the existing pickups (no new kinds).
Goal: encode the new numbers, sell the pace visually, keep the AI racing cleanly, and report a before/after table measured headlessly.
Read first: `SPEC.md`, `specs/content.md` sections 1, 6, 12 (new values, marked "tuning pass 1"), `specs/design.md` section 2 (camera) and the turbo row of the effects table, `specs/wp/WP07-ai.md` (soak, health numbers), `src/sim/soak.ts`.
Depends on: v0.2.0 on main.
Owns: values in `src/content/cars.ts`, `src/content/pickups.ts`, `src/content/tracks/scrapyard.ts` (pickups list and `referenceLapTime`); `src/render/camera.ts` (+ test) and the speed-streak effect in `src/render/fx.ts` / `src/render/particles.ts`; the AI scale constants at the top of `src/sim/ai.ts`; the expected values only in tests that pin tuning numbers (`src/sim/*.test.ts`, `src/render/camera.test.ts`, `src/content/**/*.test.ts`); `docs/tuning-log.md` (new). Anything else needs a CCR.
Dispatch: subagent (opus, effort high).

## Deliverables
1. Content values exactly as content.md now says: the 8 cars' maxSpeed and accel (x1.15 / x1.20), pickup respawn 8 s, Scrapyard's 12 pickups.
2. Camera: rest height 46 m rising to 62 m at the player's maxSpeed (design.md section 2); countdown intro still from 90 m.
3. Speed streaks on the player's turbo (design.md effects table): pooled, player only, quality high only, no per-frame allocation.
4. Re-measure with `runSoak` over 16 seeds: median clean lap of the 0.55 AI -> set Scrapyard `referenceLapTime` to it (rounded to 0.5 s).
5. Health check against WP07's targets after the speed-up: wrecks per race 0.2-2.0, no car stuck more than twice per race, skill ordering gap >= 0.8 places. If faster cars push wall impacts or wrecks out of range, first adjust only the AI side (the `ai.ts` scale constants, or AI braking margin if it is a named constant there), then report; do not change car stats beyond the table.
6. `docs/tuning-log.md`: first entry, dated, quoting the user's two sentences verbatim, listing every changed value with before/after/why, and the before/after table below.

## Acceptance tests
- [ ] `npm run verify` green (test expectations updated only where they pin a tuning number; each update listed in the report).
- [ ] Before/after table in the report and the log, both measured with the same 16 seeds: 0.55 AI median lap, 0-100 km/h time (raven), wall impacts per race, wrecks per race, pickups collected per race, end-reason counts.
- [ ] `validateTrack(SCRAPYARD)` ok with 12 pickups (every pickup `|lateral| <= width/2 - 1.5`).
- [ ] Browser pane via `preview_start` on your `wreckline-wp17` entry, `?race=1&seed=42&autoplay=1&autopause=0`: `__game.step` to results, 4 rows, no console errors; camera height at rest reads 46 +- 1 m from the renderer's camera; a screenshot during the player's turbo shows the streaks next to a `turboActive: true` readout.

## Out of scope
New pickup kinds (planned for M2 if wanted), car handling constants in `vehicle.ts`, brake values, track layout, audio.
