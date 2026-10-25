# WP14 - Car model import

**Wave C2 (after WP13U), parallel with WP10.** Goal: the 8 generated models in the game: correct facing and size, within budget, readable from the race camera, with the roof plate in the driver's color, and the procedural placeholders as the fallback.
Read first: `SPEC.md`, `specs/contracts.ts` (CarMeshSpec.model, Renderer), `specs/design.md` (Car art), `specs/content.md` sections 1 and 9, `specs/art/prompts/checks.md`, the WP03 report (carMesh rig, roof plate, harness).
Depends on: WP03 merged, WP13U done (files in `art-incoming/cars/`).
Owns: `scripts/assets/**`, `public/models/cars/**` (outside `public/assets` so `bundleSize.mjs`, which sums `dist/assets`, stays a JS budget), `src/render/carModel.ts` (+ `carModel.test.ts`), and, taken over from WP03 (nobody else writes `src/render` in C2), `src/render/carMesh.ts`, `src/render/index.ts` (the preload call) and `src/render/harness.ts` (the lineup), and the `mesh.model` values in `src/content/cars.ts` (values only). Anything else needs a CCR.
Tooling: the brain pins a glTF optimizer (e.g. `@gltf-transform/cli`) in SPEC.md section 2 before dispatch; use only that, without meshopt or Draco compression (GLTFLoader would need a decoder, and a missing one makes every model silently fall back).
Inputs: `art-incoming/` is gitignored, so the brain copies `art-incoming/cars/` from the main checkout into your worktree before dispatch.

## Deliverables
- `scripts/assets/importCars.mjs`: for each `art-incoming/cars/<id>/<id>.glb`: measure facing (the longest horizontal axis is length; the nose is the end whose 3/4 hero view matches, else the end with the bull bar/front lights: write down how you decided per car), rotate so the nose faces +x, scale so the bounding box is `length x width` from content.md (height follows), put the wheels on y = 0, decimate to <= 4000 triangles, resize textures to <= 1024 px (WebP if the optimizer supports it in glTF, else PNG), write `public/models/cars/<id>.glb`, and print a table: id, input faces, output faces, texture size, file size, facing decision. Exits 1 if any car breaks a budget.
- `public/models/cars/manifest.json`: per car the roof plate box `{ x, z, length, width, y }` (the largest flat area visible from above, measured by the script from the model's top-down height map; for OUTLAW's cage and ICEBERG's rack, on top of them).
- `src/render/carModel.ts`: `preloadCarModels(specs: CarMeshSpec[]): Promise<void>` (GLTFLoader from `three/addons`, cached by path, failures logged and left to the fallback), `getCarModel(spec): THREE.Group | null` (a clone sharing geometry and materials).
- `src/render/carMesh.ts`: `buildCarMesh(spec, color)` keeps its signature: imported model when `spec.model` is loaded, plus the roof plate from the manifest in `color` with its decal; otherwise the procedural car. `createRenderer` calls `preloadCarModels` for its entrants before the first frame. Imported wheels are part of the model and do not spin (accepted at race height).
- `src/content/cars.ts`: set every `mesh.model` to `models/cars/<id>.glb`.

## Acceptance tests
- [ ] `node scripts/assets/importCars.mjs` prints the table with every car within budget; total of `public/models/cars` <= 4 MB.
- [ ] `npm test -- carModel` -> fallback when a model fails to load, clone shares geometry, roof plate sized from the manifest.
- [ ] Lineup harness: `?harness=render&lineup=1` shows the 8 cars side by side at race camera height, and `&lineup=1&closeup=<id>` one car at garage distance; `window.__harness.lineup()` returns each car's id, bounding box and triangle count.
- [ ] Report lists, per car, the facing decision and the import table row. (The critic loop against the concept sheet runs as a brain gate after the merge: the brain screenshots the lineup and close-ups, a fresh critic agent judges, fails come back to you, then the user judges.)
- [ ] `?race=1&autoplay=1` with 4 imported cars: `drawCalls < 150`, no console errors, fps readout reported.
- [ ] `npm run verify` green.

Note: WP10's garage `CarPreview` (built in parallel) calls `buildCarMesh`, which falls back to the procedural car until models are preloaded. After both merge, the brain adds the one-line `await preloadCarModels([spec])` wiring in `CarPreview` (SPEC.md section 5 wiring rule) and re-runs the critic's garage close-ups.

Bumper spikes (CCR-5): keep WP21's procedural spike meshes on imported models, placed on the front bumper from the model's bounding box.

## Out of scope
New cars, wheel rigs for imported models, damage deformation, world props.
