# Content and tuning tables

All numbers here are **starting values**. WP00 encodes them in `src/content/*.ts` exactly as written. WP12 is the only WP that changes them after that, and it records every change in `docs/tuning-log.md`.

## 1. Cars (`src/content/cars.ts`)

Roster from the concept sheet `specs/art/cars-concept-v1.webp` (decided 2026-10-24). `forSale: false` cars are rival-only (and the boss); the shop lists only `forSale` cars other than the one owned.

| id | name | forSale | price | tier | maxSpeed | accel | brake | turnRate | grip | mass | maxHp | gunDps |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `raven` | Raven (starter) | false | 0 | 1 | 39.1 | 15.6 | 24 | 2.7 | 0.78 | 1100 | 100 | 22 |
| `outlaw` | Outlaw | false | 0 | 1 | 38 | 18 | 24 | 3.1 | 0.80 | 850 | 80 | 20 |
| `iceberg` | Iceberg | false | 0 | 1 | 36.8 | 14.4 | 22 | 2.4 | 0.76 | 1500 | 135 | 22 |
| `scorch` | Scorch | true | 6000 | 2 | 42.6 | 18 | 25 | 2.5 | 0.80 | 1400 | 140 | 26 |
| `blaze` | Blaze | false | 0 | 2 | 46 | 19.2 | 27 | 2.8 | 0.84 | 1150 | 110 | 26 |
| `titan` | Titan | true | 11000 | 2 | 40.3 | 15.6 | 26 | 2.2 | 0.80 | 1900 | 190 | 32 |
| `viper` | Viper | true | 16000 | 3 | 49.5 | 20.4 | 28 | 2.9 | 0.88 | 1200 | 120 | 30 |
| `wraith` | Wraith (boss only) | false | 0 | 3 | 51.8 | 21.6 | 30 | 2.9 | 0.90 | 1700 | 220 | 34 |

`price` is the shop price for `forSale` cars and the trade-in base for every car (starter and rival-only cars trade in for 0). Tuning pass 1 (2026-10-25, user: "a little bit too slow"): every maxSpeed x1.15 and accel x1.20 from the first values (raven was 34 / 13).

Mesh specs (procedural placeholders until the art WPs; also the collider size, so imported models are scaled to `length` x `width`):

| id | style | length | width | height | cabinLength | cabinOffset | spoiler | wheelRadius |
|---|---|---|---|---|---|---|---|---|
| raven | muscle | 4.2 | 2.0 | 0.7 | 0.45 | -0.05 | true | 0.38 |
| outlaw | buggy | 3.8 | 2.0 | 0.6 | 0.50 | -0.05 | false | 0.48 |
| iceberg | wagon | 4.9 | 2.1 | 0.8 | 0.62 | -0.12 | false | 0.40 |
| scorch | muscle | 4.8 | 2.2 | 0.8 | 0.38 | -0.12 | true | 0.42 |
| blaze | wedge | 4.4 | 2.0 | 0.55 | 0.30 | -0.08 | true | 0.36 |
| titan | truck | 5.2 | 2.4 | 1.0 | 0.35 | 0.05 | false | 0.52 |
| viper | wedge | 4.5 | 2.0 | 0.55 | 0.30 | -0.10 | true | 0.36 |
| wraith | boss | 5.2 | 2.4 | 0.9 | 0.40 | -0.08 | true | 0.46 |

Every `mesh.model` is `null` (procedural) until WP14 sets `models/cars/<id>.glb`.

M1 uses `raven` for all 4 cars.

## 2. Upgrades (`src/content/economy.ts`)

Levels 0..5 per line. Effect per level is multiplicative on the car's base stats:

| kind | effect per level | cap |
|---|---|---|
| engine | maxSpeed x1.05, accel x1.06 | - |
| tires | grip x1.04, turnRate x1.04 | grip <= 0.97 |
| armor | maxHp x1.15 (rounded) | - |
| gun | gunDps x1.12 | - |

Cost to buy level L (1..5): `[300, 700, 1500, 3000, 6000][L-1] * tierMult`, `tierMult = {1: 1, 2: 1.6, 3: 2.4}`, rounded to the nearest 10.

`computeStats(car: CarDef, up: UpgradeLevels): CarStats` lives in `src/content/economy.ts` (WP00). It applies the table above, then the caps.

## 3. Shop prices

| item | price | cap |
|---|---|---|
| repair | 4 cash per HP x tierMult of the current car, rounded up | to maxHp |
| mine | 60 each | 8 carried |
| turbo | 40 per second | 10 s carried |
| car | table price, `forSale` cars only; trade-in gives 50% of the current car's price; upgrades are lost; new car starts at full hp | - |

Starting career: cash 600, car `raven`, upgrades all 0, hp 100, mines 2, turbo 3 s.
M1 quick race: player and AI start with full hp, 3 mines, 4 s turbo.

## 4. Vehicle modifiers (used by WP01)

| state | maxSpeed | accel | grip | extra |
|---|---|---|---|---|
| turbo active | x1.30 | x1.60 | - | drains 1 turbo-second per second |
| offroad (|lateral| > width/2) | x0.70 | x0.80 | x0.60 | extra drag 4 m/s^2 opposing velocity |
| handbrake | - | 0 (no drive) | x0.35 | turnRate x1.4 |
| wrecked | - | 0 | - | linear damping 2.5, angular damping 3, inputs ignored |

## 5. Weapons and damage (used by WP02)

Machine gun:
| param | value |
|---|---|
| fire rate | 12 shots/s while `fire` held and not overheated |
| damage per shot | eff.gunDps / 12 |
| range | 45 m |
| aim assist | auto-aims at the nearest enemy (not wrecked) within a 7 deg half-angle cone of the heading, within range, with line of sight; otherwise fires along the heading |
| spread | uniform +-1.2 deg from `world.rng` |
| heat | +0.055 per shot; cools 0.45/s when not firing; at 1.0 it overheats and stays locked until heat < 0.35 |
| muzzle | 0.5 m ahead of the front bumper |

Mines:
| param | value |
|---|---|
| drop | on `dropMine` rising edge, if mines > 0 and mineCooldown == 0; cooldown 0.5 s |
| position | 1.0 m behind the rear bumper |
| arm time | 0.6 s (the owner can't trigger it before it arms) |
| trigger | any car center within 2.0 m + half car width of an armed mine |
| damage | 40 at the center, linear falloff to 20 at 4.0 m blast radius; 0 beyond |
| impulse | each hit car: velocity change of 8 m/s away from the mine, angVel += +-3 rad/s (sign from rng) |
| lifetime | 45 s, max 24 on track (oldest removed silently) |

Collisions (impact speed = |velocity after the physics step - velocity before it| for that car):
| case | damage to self |
|---|---|
| car vs car | max(0, impact - 6) * 1.6 * sqrt(otherMass / selfMass); `by` = other car |
| car vs wall/prop | max(0, impact - 9) * 1.0; `by` = null |
| same pair repeat | ignored for 0.25 s after a damaging hit (scraping) |
| `impact` event | emitted when impact >= 4 m/s |

Wrecks:
| param | value |
|---|---|
| trigger | hp <= 0 |
| credit | `lastDamagedBy` if it was set within the last 5 s, else null |
| explosion | 20 damage to other cars within 5 m (no chain credit), impulse 6 m/s outward |
| body | stays on track as an obstacle (see vehicle modifiers) |

## 6. Pickups (used by WP02)

| kind | effect | cap |
|---|---|---|
| cash | `cashPicked += 1` (meta pays per unit: easy 100, medium 200, hard 400, boss 0; quick race shows units x100) | - |
| repair | +30 hp | maxHp |
| mines | +2 | 8 |
| turbo | +2 s | 10 s |

Pickup radius 2.2 m + half car width. Respawn after 8 s (tuning pass 1; was 12 s). A full car (at cap) does not collect, the pickup stays.

## 7. Race rules (used by WP01)

| rule | value |
|---|---|
| countdown | 3 s, events at 3, 2, 1, then `raceStart` |
| checkpoints | every ~`checkpointSpacing` m (40 for all tracks); passed by segment intersection of prevPos->pos with the gate, in order only |
| lap | completed when crossing checkpoint 0 after all others in order |
| wrong way | progress decreasing for > 1.2 s while speed > 3 m/s |
| live position | finished cars by finishTime (a car that finished keeps that rank even if it is wrecked afterwards), then by `progress` desc, wrecked last (later wreck ranks higher) |
| race end | all non-wrecked cars finished, OR 15 s after the player finished, OR 2 s after the player wrecked. Unfinished cars are ranked by progress, `finished: false` |
| finished cars | (user decision 2026-10-25) a car that finished, and every car once the race phase is `finished`, keeps driving along the racing line at a calm cruise (`cruiseInput`, WP07) instead of coasting; it is immune: takes no damage, cannot be wrecked, does not fire, drop mines, trigger mines or collect pickups. Collisions with it stay physical. |

## 8. AI profiles (`src/content/ai.ts`)

`profileForSkill(skill)` linearly interpolates between these anchors (clamp skill to [0, 1.1]):

| skill | cornerSpeedFactor | lineNoise | reactionTicks | aggression | mineUse | turboUse | rubberBand |
|---|---|---|---|---|---|---|---|
| 0.0 | 0.78 | 1.6 | 14 | 0.15 | 0.15 | 0.30 | 0.06 |
| 0.5 | 0.88 | 0.9 | 9 | 0.40 | 0.40 | 0.60 | 0.04 |
| 1.0 | 0.97 | 0.3 | 5 | 0.75 | 0.70 | 0.90 | 0.00 |
| 1.1 | 1.00 | 0.2 | 4 | 0.90 | 0.85 | 1.00 | 0.00 |

reactionTicks rounds to an integer. The boss also gets +6% maxSpeed on top of `wraith` stats.

Rubber banding is mild and only in easy and medium races (user decision 2026-10-23: hard and boss never cheat). In `hard` and `boss` career races every AI profile gets `rubberBand: 0` after `profileForSkill` (WP09 applies it when building the RaceSetup). M1 quick race uses the table as is.

M1 quick race AI skills: 0.35, 0.55, 0.75. Names VEX, RAZOR, MOTH.

## 9. Liveries (M1 and rival colors)

| slot | color | use |
|---|---|---|
| player | `#FF5A1F` | hot orange (matches the UI accent) |
| ai 1 | `#2EA8FF` | blue |
| ai 2 | `#B65CFF` | violet |
| ai 3 | `#F5D547` | yellow |

Livery use: with procedural placeholder cars (M1) the whole body takes the livery color. With imported models (after WP14) the body keeps the model's own paint and the livery color tints the **roof plate** (roof panel + one big roof decal), which is what identifies a driver from the race camera. Same rule for rival colors in section 10.

## 10. Rivals (M2, `src/content/rivals.ts`)

19 rivals. Initial points = round(skill * 40). The player starts at 0 points (rank 20).

| driverId | name | color | car | skill |
|---|---|---|---|---|
| r01 | ROOK | #8C9AA8 | outlaw | 0.10 |
| r02 | BRISKET | #C9824A | iceberg | 0.15 |
| r03 | SPROCKET | #6FCF5B | raven | 0.20 |
| r04 | MAGPIE | #E8E8E8 | outlaw | 0.25 |
| r05 | RUSTY | #B5532E | iceberg | 0.30 |
| r06 | VEX | #2EA8FF | raven | 0.35 |
| r07 | GRIT | #A3A35C | outlaw | 0.40 |
| r08 | KILN | #E0703A | scorch | 0.45 |
| r09 | MOTH | #F5D547 | blaze | 0.50 |
| r10 | RAZOR | #B65CFF | titan | 0.55 |
| r11 | OXIDE | #3FB6A8 | scorch | 0.60 |
| r12 | JINX | #FF4FA3 | blaze | 0.65 |
| r13 | CINDER | #FF7A45 | titan | 0.70 |
| r14 | TALON | #5C7CFF | viper | 0.75 |
| r15 | VOLT | #C6FF3D | viper | 0.80 |
| r16 | DUCHESS | #D9B26F | blaze | 0.85 |
| r17 | HALO | #F2F2FF | viper | 0.90 |
| r18 | NOVA | #45E0FF | titan | 0.93 |
| r19 | BANSHEE | #FF3355 | viper | 0.96 |
| boss | THE WARDEN | #1A1A1A with #FF3355 trim | wraith | 1.10 |

Rivals' upgrade levels: `floor(skill * 5)` on every line, capped at 5.

## 11. Career economy (M2, used by WP09)

| tier | laps | rivals drawn from | prizes (1st..4th) | points (1st..4th) | cash pickup value | wreck bonus |
|---|---|---|---|---|---|---|
| easy | 3 | 3 rivals with the lowest skill among ranks below the player (or the bottom 6 if fewer) | 600, 350, 150, 0 | 3, 2, 1, 0 | 100 | 250 |
| medium | 4 | 3 rivals within +-3 ranks of the player | 1200, 700, 300, 0 | 6, 4, 2, 1 | 200 | 375 |
| hard | 5 | 3 rivals from the top 6 ranks | 2500, 1400, 600, 100 | 10, 6, 3, 1 | 400 | 625 |
| boss | 5 | the boss + 2 rivals from the top 3 | 10000, 0, 0, 0 | 0 | 0 | 0 |

- The boss offer replaces the hard offer while the player is rank 1. Winning it sets `championWon`.
- Track per offer: `tracks[(racesRun + tierIndex) % 3]` (easy 0, medium 1, hard/boss 2), so the three offers always differ and rotate each round.
- Off-screen rivals: after each player race, every rival not in that race gains points from a simulated result: `pts = tierPointsTable[pickTier(skill)][simPosition]`, where `simPosition` is drawn so that higher skill finishes higher on average (WP09 spec has the exact formula).

## 12. Tracks

### Scrapyard (M1, `src/content/tracks/scrapyard.ts`)

Verified with the prototype validator: length ~1049 m, min radius ~16.6 m (at s ~685), min clearance ~49.9 m (needs >= 26).

```ts
id: 'scrapyard', name: 'Scrapyard', theme: 'scrapyard',
width: 14, shoulder: 2, checkpointSpacing: 40, referenceLapTime: 31, // WP07 measured 30.95 s; WP17 re-measures after tuning pass 1 and sets it
centerline: [
  { x: 0, y: 0 }, { x: 120, y: 0 }, { x: 180, y: 20 }, { x: 205, y: 70 },
  { x: 190, y: 130 }, { x: 140, y: 150 }, { x: 110, y: 190 }, { x: 130, y: 240 },
  { x: 110, y: 290 }, { x: 60, y: 300 }, { x: 30, y: 260 }, { x: 40, y: 200 },
  { x: 0, y: 170 }, { x: -60, y: 180 }, { x: -100, y: 140 }, { x: -90, y: 70 },
  { x: -50, y: 20 },
],
pickups: [ // 12 since tuning pass 1 (user: "more bonuses"): cash 4, mines 3, turbo 3, repair 2
  { kind: 'mines', s: 70, lateral: -3 }, { kind: 'cash', s: 150, lateral: -3 },
  { kind: 'turbo', s: 230, lateral: 3 }, { kind: 'mines', s: 300, lateral: 3 },
  { kind: 'repair', s: 360, lateral: -4 }, { kind: 'cash', s: 420, lateral: 4 },
  { kind: 'mines', s: 520, lateral: -2 }, { kind: 'repair', s: 600, lateral: 0 },
  { kind: 'cash', s: 700, lateral: -3 }, { kind: 'cash', s: 820, lateral: 0 },
  { kind: 'turbo', s: 880, lateral: 3 }, { kind: 'turbo', s: 950, lateral: -2 },
],
```

Props are generated by `placeProps(base, rules)` (`src/content/tracks/placeProps.ts`, WP00) from these rules. `offset` = gap in meters between the wall and the prop's edge on that side, so the prop centre sits at lateral `+-(width/2 + shoulder + offset + propRadius(kind) * scale)` (propRadius table in WP00 section 3); `every` = spacing along s; jitter (+-1.5 m along s, +-0.5 m laterally) comes from a fixed seed (`hash(trackId)`), so the output is constant. Rules are applied in table order and a placement whose circle (propRadius * scale) overlaps any earlier prop is skipped, so validateTrack's overlap check always passes.

| sFrom | sTo | every | side | offset | kind | scale |
|---|---|---|---|---|---|---|
| 0 | length | 60 | both (alternating) | 2.5 | lightPole | 1 |
| 20 | 140 | 12 | left | 1.5 | tireStack | 1 |
| 160 | 260 | 18 | right | 3 | container | 1 |
| 300 | 420 | 10 | left | 2 | crate | 0.8-1.2 |
| 450 | 560 | 25 | right | 4 | wreck | 1 |
| 600 | 700 | 8 | both | 1.5 | barrel | 1 |
| 720 | 900 | 22 | left | 3.5 | container | 1 |
| 900 | 1040 | 14 | right | 2 | tireStack | 1 |

Plus 6 `wreck` and 10 `crate` props scattered on the infield: accepted only if they are >= 6 m from both walls and >= 4 m from each other and from every rule prop (rejection sampling, max 200 tries, seed `hash(trackId) + 1`).

### Dust Bowl and Dockside (M2)

Designed by WP11 under these constraints: length 1100-1500 m, width 13-16, min radius >= width, min clearance >= width + 2*shoulder + 8, at least one straight >= 150 m, at least one hairpin (radius < 25 m), 6-8 pickups with at least 1 of each kind. Must pass `validateTrack`.
