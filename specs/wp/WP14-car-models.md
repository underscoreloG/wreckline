# WP14 - Car model import

**Wave C3 (WP13U done 2026-10-25 via Blender MCP, not Tripo).** Goal: the 8 generated models in the game: correct facing and size, within budget, readable from the race camera, with the roof plate in the driver's color, and the procedural placeholders as the fallback.
Read first: `SPEC.md`, `specs/contracts.ts` (CarMeshSpec.model, Renderer), `specs/design.md` (Car art), `specs/content.md` sections 1 and 9, `specs/art/prompts/checks.md`, the WP03 report (carMesh rig, roof plate, harness).
Depends on: WP03, WP10, WP21 merged, WP13U done (files in `art-incoming/cars/`): all done.
Owns: `package.json` / `package-lock.json` (the pinned devDependencies only), `scripts/assets/**`, `public/models/cars/**` (outside `public/assets` so `bundleSize.mjs`, which sums `dist/assets`, stays a JS budget), `src/render/carModel.ts` (+ `carModel.test.ts`), and, taken over from WP03 (nobody else writes `src/render` in C2), `src/render/carMesh.ts`, `src/render/index.ts` (the preload call) and `src/render/harness.ts` (the lineup), and the `mesh.model`, `mesh.length` and `mesh.width` values in `src/content/cars.ts` (values only), plus expected values only in tests that pin car dimensions. Anything else needs a CCR.
Tooling (pinned in SPEC.md section 2, 2026-10-25): `@gltf-transform/core`, `@gltf-transform/functions`, `@gltf-transform/extensions` 4.5.1, `sharp` 0.35.5, `meshoptimizer` 1.3.0 (its simplifier only), all exact versions as devDependencies. Use the gltf-transform node API in the script (not the CLI). No meshopt or Draco compression in the output (GLTFLoader would need a decoder, and a missing one makes every model silently fall back).
Inputs: `art-incoming/` is gitignored, so the brain copies `art-incoming/cars/` from the main checkout into your worktree before dispatch.

## Inputs from WP13U (Blender, measured by the brain 2026-10-25)
Each `art-incoming/cars/<id>/<id>.glb` is 1 mesh, 1 material, 1892-2264 triangles, one embedded 1024 x 1024 JPEG atlas, wheels on y = 0, 0.19-0.25 MB (1.75 MB for all 8). The Blender session built each with the nose at +x and up +y: still measure the facing as below and say whether it agreed. Read every `art-incoming/cars/<id>/model-notes.md` first. Bounding boxes (x long, y up, z wide): raven 4.15 x 1.36 x 2.0, outlaw 3.79 x 1.86 x 2.0, iceberg 4.85 x 1.88 x 2.1, scorch 4.78 x 1.47 x 2.2, blaze 4.37 x 1.28 x 2.0, titan 5.04 x 2.3 x 2.4, viper 4.47 x 1.5 x 2.0, wraith 5.36 x 1.56 x 2.4 (spikes included; the user accepted the smaller body this gives after the fit).
Roof plate notes from the models (the detector may pick the wrong surface on these; a per-car manual box in the script is allowed, say which):
- OUTLAW: open roll cage, no flat panel on top (user's choice). Put the plate on the cage top rails; the box is in its model-notes.md.
- ICEBERG: the largest flat area from above is the roof panel under the rack (about 1.77 m); draw the plate on the rack top (about 1.885 m) or the rack hides it.
- TITAN: the turret sits on a pedestal at the front of the bed and its barrel reaches forward over the cab roof (barrel about 2.18 m high, to x = -0.24 m in the model). The plate goes on the cab roof and must stay readable from the race camera under the barrel: report a top-down screenshot.
- BLAZE and VIPER share a body; the user had them told apart (BLAZE low lip wing, VIPER tall wing, narrower front). The lineup must show that from race height.
- BLAZE's roof texture carries the sheet's white stripes (accepted); the plate covers them.

## Deliverables
- `scripts/assets/importCars.mjs`: for each `art-incoming/cars/<id>/<id>.glb`: measure facing (the longest horizontal axis is length; the nose is the end whose 3/4 hero view matches, else the end with the bull bar/front lights: write down how you decided per car), rotate so the nose faces +x, scale so the bounding box is `length x width` from content.md (height follows), put the wheels on y = 0, decimate to <= 4000 triangles, resize textures to <= 1024 px (WebP via `EXT_texture_webp`, which three's GLTFLoader reads; else keep the JPEG), write `public/models/cars/<id>.glb`, and print a table: id, input faces, output faces, texture size, file size, facing decision. Exits 1 if any car breaks a budget.
- `public/models/cars/manifest.json`: per car the roof plate box `{ x, z, length, width, y }` (the largest flat area visible from above, measured by the script from the model's top-down height map; for OUTLAW's cage and ICEBERG's rack, on top of them).
- `src/render/carModel.ts`: `preloadCarModels(specs: CarMeshSpec[]): Promise<void>` (GLTFLoader from `three/addons`, cached by path, failures logged and left to the fallback), `getCarModel(spec): THREE.Group | null` (a clone sharing geometry and materials).
- `src/render/carMesh.ts`: `buildCarMesh(spec, color)` keeps its signature: imported model when `spec.model` is loaded, plus the roof plate from the manifest in `color` with its decal; otherwise the procedural car. `createRenderer` calls `preloadCarModels` for its entrants before the first frame. Imported wheels are part of the model and do not spin (accepted at race height).
- Hitbox follows the art (user decision 2026-10-25): per car, measure the imported model's top-view length:width ratio `r` (bounding box, rams, spikes and wings included); keep the collider area `A = length * width` from content.md and set `length = sqrt(A * r)`, `width = sqrt(A / r)`, rounded to 0.05 m; then scale the model uniformly to that box. Report old and new dimensions per car; the brain updates content.md section 1. Re-run WP12's probe table (`node scripts/balance/run.mjs`) and report every row against WP12's merged values in `docs/tuning-log.md` (WP12 is merged; any rebalancing is a separate WP, so report, do not retune).
- `src/content/cars.ts`: set every `mesh.model` to `models/cars/<id>.glb`.

## Acceptance tests
- [ ] `node scripts/assets/importCars.mjs` prints the table with every car within budget; total of `public/models/cars` <= 4 MB.
- [ ] `npm test -- carModel` -> fallback when a model fails to load, clone shares geometry, roof plate sized from the manifest.
- [ ] Lineup harness: `?harness=render&lineup=1` shows the 8 cars side by side at race camera height, and `&lineup=1&closeup=<id>` one car at garage distance; `window.__harness.lineup()` returns each car's id, bounding box and triangle count.
- [ ] Report lists, per car, the facing decision and the import table row. (The critic loop against the concept sheet runs as a brain gate after the merge: the brain screenshots the lineup and close-ups, a fresh critic agent judges, fails come back to you, then the user judges.)
- [ ] `?race=1&autoplay=1` with 4 imported cars: `drawCalls < 150`, no console errors, fps readout reported.
- [ ] `npm run verify` green.

Note: WP10's garage `CarPreview` (built in parallel) calls `buildCarMesh`, which falls back to the procedural car until models are preloaded. After both merge, the brain adds the one-line `await preloadCarModels([spec])` wiring in `CarPreview` (SPEC.md section 5 wiring rule) and re-runs the critic's garage close-ups.

Bumper spikes (CCR-5): add WP21's `buildSpikesGeometry(spec)` to imported models as one extra mesh (+1 draw call), placed on the front bumper from the model's bounding box.

## Out of scope
New cars, wheel rigs for imported models, damage deformation, world props.
