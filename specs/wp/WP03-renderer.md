# WP03 - Renderer

Goal: the race looks modern: procedural low-poly cars and track, dusk lighting, bloom, particles, skid marks and a smooth follow camera, at 60 fps.
Read first: `SPEC.md`, `specs/contracts.ts` (renderer API, conventions header), `specs/design.md` sections 1-3, `specs/content.md` sections 1, 9, 12.
Depends on: WP00. Develop against `createFakeSim` (it emits every event type you render).
Owns: `src/render/**`. Anything else needs a CCR.

## Deliverables

| File | Exports / does |
|---|---|
| `index.ts` | `createRenderer(opts): Promise<Renderer>`, `buildCarMesh(spec, color): THREE.Group` |
| `scene.ts` | scene, fog, lights, shadow-follow, quality switching |
| `post.ts` | composer setup for `high`, plain render for `low` |
| `camera.ts` | follow camera per design.md section 2 (spring, lookahead, height, shake, countdown intro, wreck mode) |
| `textures.ts` | CanvasTexture generators: asphalt, dirt, ground, kerb, all 512x512, seeded noise (use `createRng` from shared, fixed seed) |
| `trackMesh.ts` | road ribbon, shoulders, kerbs, walls, start/finish line + gantry, ground plane, from `TrackGeometry` |
| `props.ts` | one `InstancedMesh` per prop kind, procedural geometry per kind (see below) |
| `carMesh.ts` | `buildCarMesh` + per-car runtime rig (wheels spin/steer, lights, damage tint) |
| `particles.ts` | pooled particle system (design.md section 3) |
| `skidmarks.ts` | ring-buffer skid quads |
| `fx.ts` | event -> effect mapping (tracers, sparks, explosions, scorch decals, muzzle flash, turbo flames, pickups, mines) |
| `themes/index.ts` | `ThemeDef` type and `THEMES: Partial<Record<TrackTheme, ThemeDef>>` with `scrapyard` filled from design.md section 1. `ThemeDef` = every world palette token (including `water`, see design.md), hemisphere sky/ground colors + intensity, key light color/intensity/direction, fog color/density. WP11 later adds `desert.ts`/`docks.ts` and registers them here |
| `harness.ts` | `mountRenderHarness(root)` |
| `*.test.ts` | pure-logic tests only (camera math, interpolation, ring buffer); no WebGL in Node |

## Behaviour and numbers

**Interpolation.** For each car, render position = `lerp(prev.pos, curr.pos, alpha)`, heading = `lerpAngle(prev.heading, curr.heading, alpha)`. Map with `x -> x, y -> z`, `mesh.rotation.y = -heading` (contracts header). Write a test for the mapping: a car at heading `PI/2` (facing +y in sim, screen down) has its mesh nose pointing to world +z.

**Car mesh** (`buildCarMesh`), modeled facing +x, origin at the ground center, total < 400 triangles:
- Body: box `length x height x width` with the top edges chamfered (beveled extrude of a side profile per style: `compact` rounded, `muscle` long hood, `wedge` low sloped nose, `boss` tall with front ram plate), raised by `wheelRadius * 0.9`.
- Cabin: tapered box `cabinLength * length` long, 0.75 x width, 0.45 m tall, at `cabinOffset`, dark glass material `#14181F` roughness 0.2.
- Wheels: 4 cylinders (radius `wheelRadius`, width 0.3 m, 10 segments) at +-0.36 length, +-0.5 width. Snapshots carry no steer input, so front wheels turn by `steerVisual = clamp(angVel * length / max(|speed|, 1), -0.45, 0.45)` rad; all wheels spin by `distance / wheelRadius`.
- Gun: small dark box + barrel on the roof front.
- Spoiler when `spoiler` is true.
- Style extras, so each roster car has its own silhouette from above (the race camera reads cars by silhouette and roof): `buggy` = no body shell over the cabin, an open roll cage of 6 thin bars and a 4-lamp light bar; `wagon` = long flat roof to the rear plus a roof rack frame; `truck` = tall cab with an open bed and a turret box on the bed; `muscle` = long hood with a bull bar; `boss` = front ram plate plus 8 short cone spikes along the sides. Each extra is a few boxes or cylinders, inside the same < 400 triangle budget and merged with the body.
- Roof plate: a separate thin box on the roof top (90% of the roof area) in the livery color, with one bold decal shape (a square, chevron or circle chosen by `hashString(color) % 3`, since `buildCarMesh` gets no CarId) in a darker shade, as vertex colors on the plate itself (one draw call). It is its own mesh so WP14 can keep it when the body becomes an imported model.
- Livery: body color = entrant color (placeholder rule; with imported models only the roof plate takes it, content.md section 9); one darker stripe (color * 0.6) over the hood. Head lights white emissive 2.0, tail lights `#FF2A2A` emissive 1.0 (3.0 when `braking`).
- Merge static parts into one geometry per material (`mergeGeometries` from `three/addons/utils/BufferGeometryUtils.js`): body, glass, lights, gun = at most 4 draw calls. Wheels stay 4 separate meshes sharing one geometry and material (they spin and front ones steer), so a car is at most 9 draw calls (with the roof plate).

**Track mesh:** road as a triangle strip between `leftEdge`/`rightEdge` with UV `u = across (0..1)`, `v = s / 8` (texture repeats every 8 m); shoulders as strips edge->wall; kerbs as 1 m strips on both edges where `|curvature| > 1/40`, alternating `kerbA/kerbB` every 2 m (vertex colors, no texture); walls as an extruded profile (0.9 m tall, 0.6 m thick) along each wall polyline, alternating concrete blocks and tire-wall sections every 24 m. Ground: 1200 x 1200 m plane, `ground` texture repeat 1/6 m. When the theme's `water` is non-null, the ground on the water side of its half-plane (design.md section 1) uses the water color (a second plane clipped to the half-plane is fine) with a 0.5 m `asphaltLine` strip along the edge. Start line: checkered strip across the road + a gantry (2 posts + beam with 5 emissive lamps that go red, red, red, then green with the countdown events).

**Props** (procedural, flat shaded, theme palette): crate = box 1.4 m; tireStack = 3 stacked torus-ish cylinders; barrel = cylinder with 2 rings, randomly rust/blue-grey; container = 6.1 x 2.6 x 2.4 box with ridge lines (vertex color stripes); wreck = squashed `buildCarMesh('compact', '#4A3B2C')` merged; lightPole = 8 m pole + arm + emissive bulb + ground lamp-pool quad; cone, rock (icosahedron jittered), cactus, building = for WP11 themes, implement simple versions now. One `InstancedMesh` per kind.

**Quality switch:** `setQuality('low')` disables shadows, the composer, sets pixelRatio 1; `high` uses `min(devicePixelRatio, 2)`. Switching at runtime must not leak (dispose composer targets).

**Events -> effects:** every SimEvent type in contracts maps to the effect table in design.md section 3. `countdown` and `raceStart` drive the gantry lamps. `pickupCollected` = burst of 16 particles in the pickup's color + icon scale-out 0.2 s.

**Renderer reuse and dispose:** `createRenderer` keeps one `THREE.WebGLRenderer` per canvas in a module-level `WeakMap<HTMLCanvasElement, WebGLRenderer>` and reuses it on later calls (no new GL context per race, so `renderer.info.memory` keeps counting across races). `dispose()` frees this race's scene, geometries, materials, textures and composer targets, but not the cached WebGLRenderer. `stats()` returns `geometries`/`textures` from `renderer.info.memory` (contracts.ts). The harness has a "recreate x10" button that calls `dispose()` + `createRenderer` on the same canvas 10 times and logs `stats()` before/after.

## Harness (`?harness=render`)
Full-screen canvas running `createFakeSim(buildQuickRaceSetup({ seed: 7 }))` at 60 Hz with the real loop pattern (accumulator, interpolation). Overlay (plain DOM, top-left): fps, draw calls, triangles, quality toggle, camera shake toggle, "follow car 0-3" buttons, "free orbit" toggle (OrbitControls from `three/addons`), "trigger explosion at player", "recreate x10". `window.__harness = { renderer, sim, stats() }`.

## Acceptance tests
- [ ] `npm test -- render` -> pure-logic tests pass (mapping, lerpAngle wrap at +-PI, skid ring buffer wraps, camera spring converges within 1 s, trauma decays to 0).
- [ ] `?harness=render` at 1920x1080, `high`: `__harness.stats().fps >= 58` averaged over 10 s with the pane visible, `drawCalls < 150`.
- [ ] Same at `low`: draw calls lower, no shadows (`renderer.shadowMap.enabled === false`).
- [ ] Screenshot set in the report: countdown gantry, racing (4 cars + smoke + tracers), explosion, wrecked car smoke, pickups and mines visible. Each next to a `__harness` state readout proving the moment.
- [ ] "recreate x10": `__harness.stats().geometries` and `.textures` return to the baseline (same cached WebGLRenderer, so the counts are comparable).
- [ ] Heading test: fake car turning right on screen has its nose following its motion (visual + the mapping unit test).

## Allowed deferrals
Theme variants `desert`/`docks` palettes (WP11 adds them under `src/render/themes/`). `applyTheme(theme: TrackTheme)` reads `THEMES[theme]` (falls back to scrapyard with a console warning) and is called by `createRenderer` from `opts.track.def.theme`; it is the only code that turns a `ThemeDef` into scene settings, so WP11 adds themes as data only.

## Out of scope
UI or HUD in the canvas (HUD is DOM, WP04). Audio. Garage turntable renderer (WP10 builds it with your `buildCarMesh`). Real 3D models or texture files.
