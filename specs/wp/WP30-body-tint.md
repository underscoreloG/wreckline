# WP30 - Body tint in the driver colour instead of the roof plate

**User request (2026-10-26), verbatim:** "also is it hard to remove the color plates from the roof of each car?" The user then chose (brain proposal): drop the plate and tint each car's body toward its driver colour, so same-model rivals still differ (19 rivals share 7 models; 4 drive VIPERs).

Read first: `SPEC.md`, `specs/design.md` section 1 ("Car art", livery), `specs/content.md` sections 9 and 10 (colours), `src/render/{carMesh,carModel}.ts` and their tests, `src/render/harness.ts`, `src/ui/screens/career/CarPreview.tsx` (read only: it shows the player car through the renderer).
Owns: `src/render/**`, `specs/design.md`. Nothing else (WP29 runs in parallel in content/meta/game/ui).
Dispatch: subagent (opus, effort high). Art check by the brain on your screenshots after the report.

## Change
- Remove the roof plate everywhere: imported models (the `roofPlate` mesh and its trim) and the procedural fallback cars. `getRoofPlate` and the manifest's plate boxes may stay in the data (do not edit `public/models/**` or `scripts/assets/**`); just stop building the mesh. Remove `plateMaterial` from the parts if nothing else needs it.
- Tint the imported body material toward the driver colour: `bodyMaterial.color = lerp(white, driverColour, BODY_TINT)`, a named constant. Start near 0.5 and tune by looking at race-camera screenshots. The model textures are dark and dirty, so a plain multiply may darken too much: if so, a small emissive in the driver colour (named constant, low) is allowed. Report the final values.
- The existing damage and wreck darkening (`bodyMaterial.color.setScalar(tint)` in the update loop) must compose with the driver tint (driver tint x damage scalar), not overwrite it. A wrecked car still reads as a dark hulk.
- Procedural fallback cars already take the livery colour on the whole body: keep that.
- Garage turntable (CarPreview) shows the player car with the player tint, no plate.
- Draw calls per car drop by one; report before/after in a race.

## Acceptance tests
- [ ] Unit: no `roofPlate` mesh in an imported or procedural car; body colour = tint for a given driver colour; damage scalar composes (hp 50% and wrecked) and returning to full hp restores the pure tint.
- [ ] Screenshots at race camera height (render harness or `?race=1&ai=7`), into `../wreckline-wt/wp30-shots/`: (a) the 4 VIPER rival colours side by side (TALON `#5C7CFF`, VOLT `#C6FF3D`, HALO `#F2F2FF`, BANSHEE `#FF3355`), (b) the player (`#FF5A1F`) in a pack of 8 on Dust Bowl (day) and on Neon Mile (night), (c) the garage turntable. The 4 VIPERs must be told apart at a glance, and the player car must stand out in the pack; say honestly if either fails.
- [ ] `specs/design.md` section 1: the plate lines become the body tint rule (keep the silhouette rule).
- [ ] `npm run verify` green; draw calls in a race before/after; no console errors.

## Out of scope
New textures or models, HUD or minimap changes, any ground marker under the player car (if the player does not stand out, report it: the brain decides).
