# Design: art direction, camera, UI

## 1. Art direction

**"Neon scrapyard at dusk."** Stylized low-poly, flat-shaded geometry, a dark world lit by warm sodium lamps, with saturated car liveries and hot emissive accents that bloom. Readability first: from 55 m up, the player must tell every car, the road edge, pickups and mines apart in under half a second.

Rules:
- Flat shading (`flatShading: true`) on all procedural meshes. `MeshStandardMaterial`, roughness 0.55-0.8, metalness 0-0.3.
- The world is desaturated, cars and pickups are saturated. No world prop uses a livery color.
- Emissive only for lights, pickups, mines' blinking LED, muzzle flashes, explosions and turbo flames. Bloom threshold makes only these glow.
- No textures from files for the world. (Car models after the fun gate carry their own GLB textures, WP14.) Road, dirt and ground textures are generated at boot on a `CanvasTexture` (noise + markings), 512x512, repeat-wrapped.

### World palette (theme `scrapyard`; WP11 defines `desert` and `docks` the same way)

| token | hex | use |
|---|---|---|
| ground | `#2A2622` | base terrain |
| groundNoise | `#3A332C` | noise speckles |
| asphalt | `#2F3236` | road |
| asphaltLine | `#C9C2A8` | dashed center line, 30% opacity |
| kerbA / kerbB | `#D8D2C4` / `#C2382B` | kerbs on corners with |curvature| > 1/40 |
| dirt | `#4A3B2C` | shoulder |
| wall | `#5E5A55` | concrete barriers |
| tireWall | `#1C1C1E` | tire walls |
| propRust | `#7A4A2A`, `#8F5B32` | containers, crates, wrecks |
| sodiumLight | `#FFB35C` | lamp pools, directional key light tint |
| skyFog | `#1B1E26` | fog and clear color |
| water | none in scrapyard | ground color of the water area (docks theme, e.g. `#0E2230`) |

Water: `ThemeDef.water` is `{ color: string; point: Vec2; normal: Vec2 } | null`. The renderer paints the ground plane with `color` on the side of the line through `point` that `normal` points to (a half-plane), plus a thin `asphaltLine` edge strip along that line. Only the docks theme sets it, with values matching Dockside's layout (WP11). Water is visual only: no collider, the track walls keep cars out.

### New themes (CCR-6, WP22 sets exact tokens like WP11 did)

- **snow**: night, cold blue key light (around `#A8C4FF`, 0.9), snow ground near `#D8E2EA` with blue-grey noise, dark asphalt kept readable, denser fog near `#1A2230`. Props: `pine` (cone stack, dark green), `snowbank` (low white mound along walls), light poles with warm sodium pools for contrast.
- **city**: rainy night look without particles: darker, slightly blue asphalt and kerb tokens and more lamp pools give the wet feel (no material or roughness change), purple-black fog near `#120A1E`, `building` blocks as walls of the street, `billboard` props with emissive magenta / cyan panels that bloom. Cars must stay the most saturated things on screen: billboards sit outside the walls, never over the road.
- **quarry**: hot late afternoon, high contrast, warm key light, light dusty fog near `#B89A7A`, ochre and red rock ground, `rock` clusters and a `crane` (static gantry crane, tall) as landmarks.

Readability rule for all: the road edge, cars, pickups and mines must stay as legible as on Scrapyard (same 0.5 s glance test).

### Car art (after the fun gate)

Look target: `specs/art/cars-concept-v1.webp` (8 cars: RAVEN, BLAZE, TITAN, VIPER, OUTLAW, SCORCH, ICEBERG, WRAITH). Grungy low-poly bodies with rust, chipped paint, bull bars, spikes and pixel-crisp decals. M1 races with the procedural placeholders of WP03; WP13 and WP14 bring the real models after a "yes" at the fun gate.

Readability rules (the race camera is 46-62 m up with FOV 34 (tuning pass 1), so a car is ~150 px long at 1080p at rest (WP03 measured ~135 px at 52 m); the earlier ~40 px estimate was wrong):
- Each car is told apart by **silhouette** from above (buggy cage, wagon roof rack, truck bed and turret, wedge wing, boss spikes) and by its **roof plate** in the driver's livery color with one bold decal (content.md section 9).
- Grunge, small decals and skulls are for the garage, shop and results screens, where cars are seen up close. Nothing gameplay-relevant depends on them.
- Body paint stays as in the concept; it must still contrast with the dark world palette (no car body darker than `#2A2622` over more than half its top area without a lighter trim line: RAVEN and WRAITH get a light edge trim on the roof plate).

### Lighting (quality `high` / `low`)

| element | high | low |
|---|---|---|
| HemisphereLight | sky `#5A6A8A`, ground `#2A2622`, intensity 0.55 | same |
| DirectionalLight (key, warm dusk) | `#FFC48A`, 1.6, from (-0.6, -1, 0.35) direction, 2048 shadow map following the player, PCFSoft, shadow box 120 m | no shadows |
| Lamp pools | additive radial-gradient quad on the ground under each lightPole + small emissive bulb sprite. No real point lights. | same |
| Headlights | 2 emissive quads per car + one additive cone quad on the ground, 14 m long | quad only |
| Tail lights | emissive, intensity x3 when `braking` | same |
| Fog | `FogExp2('#1B1E26', 0.006)` | same |
| Tone mapping | `ToneMappingEffect` AGX (via postprocessing), exposure 1.0 | renderer `ACESFilmicToneMapping`, no composer |

### Post-processing (`high` only)

`EffectComposer` -> `RenderPass` -> `EffectPass(SMAAEffect, BloomEffect{ luminanceThreshold: 0.75, luminanceSmoothing: 0.2, intensity: 1.1, mipmapBlur: true }, VignetteEffect{ darkness: 0.45, offset: 0.3 }, ToneMappingEffect{ mode: AGX })`. Renderer `toneMapping = NoToneMapping` when the composer is active.

## 2. Camera

- Perspective, FOV 34 deg, near 1, far 600. Fixed world orientation (north-up), never rotates with the car.
- Position = `target + (0, height, height * 0.32)` looking at `target`. That tilts the view about 18 deg so car sides and walls read in 3D.
- `height` = 46 m at rest, rising linearly to 62 m at the player's `eff.maxSpeed`, smoothed with a 0.4 s time constant (tuning pass 1, was 52-64: closer at low speed and a bigger pull-back at speed sell the pace).
- `target` = player pos + player velocity * 0.35 s, clamped to 14 m from the car, smoothed by a critically damped spring (smooth time 0.18 s).
- Shake: trauma model. Trauma += 0.25 for player impact >= 8 m/s, 0.4 for a nearby mine (< 12 m), 0.6 for a wreck explosion < 15 m. Trauma decays at 1.6/s. Offset = trauma^2 * 1.2 m * value noise (x, z). Disabled when `cameraShake` is off.
- During countdown: start from height 90 and ease to the normal height over the 3 s countdown.
- After the player wrecks: keep target on the wreck, height eases to 70 m.

## 3. Effects (WP03)

| effect | trigger | look |
|---|---|---|
| tire smoke | car `drifting` or handbrake at speed > 8 | grey puffs from rear wheels, 0.8 s life, grow x3, alpha 0.35 -> 0 |
| skid marks | same as tire smoke | dark quads on the ground, 0.4 m wide, ring buffer of 4000 segments, fade out over the last 25% of the buffer |
| damage smoke | hp < 40% maxHp | dark smoke from the hood, rate scales with damage |
| fire | hp < 15% maxHp | orange-yellow additive flames + embers at the hood |
| sparks | `impact` event, or a `gunShot` that hit a wall/car | 12-30 additive streaks, 0.25 s, gravity-like falloff in the ground plane |
| muzzle flash | `firing` | additive star quad at the muzzle, random rotation each shot, 1 frame + point flash on ground |
| tracers | `gunShot` | thin additive line from->to, 60 ms fade, color `#FFE08A` |
| mine | `MineState` | dark disc + red LED blinking at 2 Hz unarmed, 5 Hz armed |
| explosion | `mineExploded`, `carWrecked` | flash sphere (0.1 s), fireball particles, dark smoke column (3 s), debris chunks, ground scorch decal (stays for the race), shockwave ring |
| turbo | `turboActive` | blue-white flame cones at the exhaust + subtle FOV +3 deg for the player + speed streaks: 20-30 thin additive white lines (0.05 m wide, 4-8 m long, 0.25 s life) spawned in a ring 6-20 m around the player car, aligned with its velocity, fading in and out (player only, quality high only) |
| pickups | active `PickupState` | floating rotating icon mesh (cash: green box with $ shape, repair: white wrench-like cross, mines: red disc stack, turbo: blue canister), emissive, bob 0.3 m at 1 Hz, ground glow ring |
| wreck | `wrecked` | car material darkened to 20% brightness, wheels detached slightly (tilted), smoke column until race end |

One pooled particle system: `InstancedMesh` of camera-facing quads (max 3000), a single additive material and a single alpha material. No per-particle allocations.

## 4. UI design system (WP04, WP10)

### Tokens (`src/ui/theme.css`)

```css
:root {
  --bg: #0B0D10;
  --panel: rgba(16, 19, 24, 0.78);
  --panel-solid: #12151A;
  --line: rgba(255, 255, 255, 0.08);
  --line-strong: rgba(255, 255, 255, 0.18);
  --text: #E8EAED;
  --muted: #8A93A0;
  --accent: #FF5A1F;
  --accent-ink: #120700;
  --cash: #2EE6A6;
  --danger: #FF3355;
  --warning: #FFC23D;
  --info: #2EA8FF;
  --radius-panel: 10px;
  --radius-control: 6px;
  --font-display: 'Chakra Petch', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --t-fast: 120ms;
  --t-med: 220ms;
}
```

- Display font: Chakra Petch 600/700, uppercase, letter-spacing 0.04em. Body: Inter 400/500/600. Numbers in the HUD use `font-variant-numeric: tabular-nums`.
- Type scale (rem, root = clamp(14px, 0.9vw, 18px)): 0.75, 0.875, 1, 1.25, 1.75, 2.5, 4 (hero).
- Panels: `--panel` + `backdrop-filter: blur(14px) saturate(1.2)`, 1px `--line` border, `--radius-panel`.
- Buttons: height 44px min. Primary = filled `--accent`, text `--accent-ink`. Secondary = transparent, 1px `--line-strong`. Focus/selected = 2px `--accent` outline with 2px offset + slight scale 1.02. The selected item is always visible, because menus are driven by keyboard/gamepad.
- Motion: screen transitions fade + 12px slide, `--t-med`. List items stagger 30 ms. Everything off under `prefers-reduced-motion: reduce`.
- Contrast: body text vs panel >= 4.5:1.
- Min viewport 1024x640. Layout scales with the root font size, no mobile layout.

### Navigation model

- Every screen is fully usable with arrows + Enter + Esc, and gamepad d-pad/stick + A + B. The mouse also works (hover = focus).
- Focus is managed by a `useMenuFocus(items)` hook (WP04): a vertical or grid list, wrap-around off, `move` sound on change, `confirm` on Enter/A, `back` on Esc/B.
- Esc during a race = pause. Esc in a menu = back.

### Key hints

The user dislikes on-screen clutter: key hints appear as **one compact keycap row** on the pre-race and pause screens only, never during racing. Full bindings live on the CONTROLS screen. With a gamepad active, hints show gamepad glyphs (A/B/X/Y, LT/RT as text pills).

## 5. Screens

### Title
Full-bleed live background: the renderer running the fake sim with 4 cars on Scrapyard, camera slowly orbiting at height 80 (WP08 wires it; WP04 shows a dark gradient placeholder). Left column: wordmark "WRECKLINE" (display font 4rem, accent underline bar), menu: QUICK RACE / CAREER (M2, disabled with "Coming soon" in M1) / CONTROLS / SETTINGS. Version bottom-left in `--muted`.

### Controls
Two-column table: action, keyboard keycaps, gamepad glyph. Bindings are fixed in M1 (no rebinding).

### Settings
Sliders: master volume, effects volume (0-100, step 5). Toggles: quality high/low, camera shake, show FPS. Changes apply instantly and persist (`wreckline.settings.v1`).

### Pre-race
Track name, a mini track outline (SVG from `minimapPath`), laps, the entrant list as cards (color swatch, name, car). Key hint row. START (primary) / BACK.

### HUD (during race)
| zone | content |
|---|---|
| top-left | position "2" huge (display 4rem) + "/4" small; under it "LAP 2/3", current lap time, best lap |
| top-right | minimap: SVG of `minimapPath` (2px `--line-strong`), car dots in livery color (player dot larger with white ring), wrecked = hollow; kill feed under it (max 3 lines, fade after 4 s) |
| bottom-left | HP bar (10 segments, color `--cash` > 60%, `--warning` > 25%, else `--danger`, pulsing below 25%); turbo gauge (seconds, blue `--info`, glows when active); mines count with icon; gun heat thin bar (turns `--danger` and blinks when overheated) |
| bottom-right | speed in km/h (display 2.5rem tabular) + a thin arc gauge |
| center | countdown 3-2-1-GO (scale-in, 0.8 s each), banners (LAP 2, FINAL LAP, FINISHED, WRECKED) 1.5 s, WRONG WAY blinking in `--danger` |
| full screen | red edge vignette flash on `hitFlash` (opacity = hitFlash * 0.5) |

HUD panels are compact pills, not big boxes. Nothing in the center third of the screen except countdown/banners.

### Pause
Blurred dim overlay (the game frame stays visible). RESUME / RESTART / SETTINGS / QUIT TO MENU. Key hint row.

### Results
Table: POS, DRIVER (swatch + name), BEST LAP, TIME (or DNF/WRECKED), WRECKS, and in M2 PRIZE. The player row is highlighted with an accent left bar. Rows animate in with a stagger. Buttons: CONTINUE (primary), RESTART (quick race only).

### M2 screens (WP10)
- **Career hub:** left = player card (car name, cash in `--cash`, rank, points), right = buttons RACE / GARAGE / SHOP / STANDINGS / SAVE & QUIT.
- **Garage:** live 3D car preview (turntable, `buildCarMesh`, its own small `WebGLRenderer` on a canvas, 512x320, studio lighting), stat bars (speed, accel, grip, armor, gun) showing base vs upgraded, hp bar with REPAIR shortcut.
- **Shop:** tabs UPGRADES / SUPPLIES / CARS. Upgrade tiles: name, 5 level pips, next level cost, the stat delta it gives ("+5% top speed"). Disabled when too expensive (cost turns `--danger`). Buying plays `buy`, flashes the cash counter.
- **Race select:** 3 offer cards side by side (tier color strip: easy `--cash`, medium `--warning`, hard `--danger`, boss black with red trim), track outline, laps, rivals list with their rank, prize table. Selecting goes to pre-race.
- **Standings:** ladder of 20 rows (rank, name, points, car), the player row highlighted, the boss shown on top as a locked "?" row until the player reaches rank 1.
- **Champion:** hero screen with confetti particles (CSS), stats summary (races, wins, wrecks, cash earned), NEW CAREER / TITLE.
