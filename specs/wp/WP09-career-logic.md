# WP09 - Career logic

Goal: a pure, tested career model: ladder, race offers, payouts, shop, saves, and a headless career simulator for balance.
Read first: `SPEC.md`, `specs/contracts.ts` (meta section), `specs/content.md` sections 2, 3, 10, 11.
Depends on: M1 gate passed (go). Parallel with WP11.
Owns: `src/meta/**`. Anything else needs a CCR.

## Deliverables

| File | Exports |
|---|---|
| `career.ts` | `newCareer(seed: number): SaveGame`; `rankOf(save): number` (1-based among player + 19 rivals, ties: player ranks below a rival with equal points); `ladder(save): { driverId: string; name: string; points: number; carDefId: string; isPlayer: boolean }[]`; `generateOffers(save): { offers: RaceOffer[]; save: SaveGame }` (advances `rngState`); `buildCareerRaceSetup(save, offer, seed): RaceSetup`; `applyRaceResult(save, offer, result): { save: SaveGame; payout: Payout }` |
| `shop.ts` | `shopCars(save): CarDef[]` (`forSale` cars not owned, table order), `canAfford`, `buyUpgrade(save, kind)`, `buyCar(save, carDefId)`, `repair(save, amount)`, `buyMines(save, n)`, `buyTurbo(save, seconds)`; each returns `{ ok: true; save } \| { ok: false; reason: 'cash' \| 'max' \| 'owned' \| 'invalid' }` |
| `save.ts` | `interface KeyValueStore { get(k): string \| null; set(k, v): void; remove(k): void }`; `loadSave(store)`, `writeSave(store, save)`, `clearSave(store)`; key `wreckline.save.v1`; validates shape and version, returns null on corrupt data (never throws) |
| `offSim.ts` | `simulateOtherRivals(save, offer, rng): SaveGame` |
| `careerSim.ts` | `simulateCareer(seed, policy): CareerRun` for WP12 (headless, uses a results model, not the physics sim) |
| `*.test.ts` | tests below |

## Behaviour and numbers
- All functions pure: inputs are never mutated, outputs are new objects. RNG = `createRng(save.rngState)`, and the new state is written back.
- **Offers:** easy, medium, hard per content.md section 11 (boss replaces hard at rank 1). Rival selection exactly as the table; if a bracket has fewer than 3 rivals, fill from the nearest ranks. Track: `tracks[(racesRun + tierIndex) % tracks.length]` with `tierIndex` easy 0, medium 1, hard/boss 2. Deterministic, the three offers always show three different tracks, and no SaveGame field is needed.
- **Race setup:** player entrant from save (`computeStats(car, upgrades)`, hp, mines, turbo); rivals as entrants with their car, `computeStats(car, floor(skill * 5) on all lines)`, full hp, 2 mines, 3 s turbo, `profileForSkill(skill)`, with `rubberBand` forced to 0 for `hard` and `boss` offers (content.md section 8: hard and boss never cheat); the boss uses `wraith` + 6% maxSpeed. Liveries from rivals' colors.
- **Payout:** `prize = offer.prizes[pos - 1]` if the player finished (0 for DNF); `wreckBonus = wrecksCaused * tierWreckBonus`; `pickups = cashPicked * tierCashValue`; `total` sum; `pointsGained = finished ? offer.points[pos - 1] : 0`. Rivals in the race gain points by their own result rows.
- **After the race:** player `hp/mines/turbo` = result row leftovers (a wrecked player ends at hp 0 and must repair before racing: `buildCareerRaceSetup` throws if hp <= 0, the UI blocks RACE with a message), `racesRun++`, `wins++` on 1st, cash += total. Then `simulateOtherRivals`.
- **Off-screen rivals:** for each rival not in the player's race: pick their tier by skill (`< 0.4` easy, `< 0.75` medium, else hard); simulate a 4-car finishing order with weights `w = exp(4 * skill)` for them and 3 phantom opponents of skill = their tier's median skill (easy 0.25, medium 0.55, hard 0.85); award that tier's points for their position.
- **Champion:** boss offer won (position 1) -> `championWon = true`. Losing the boss race costs nothing extra; the player stays rank 1 only if points still say so.
- **Car purchase:** see content.md section 3. Selling the current car: 50% of its price (starter 0). Upgrades reset to 0, hp = new maxHp.

## Acceptance tests
- [ ] `npm test -- meta` passes:
  1. `newCareer(1)` matches content.md: cash 600, raven, 19 rivals, points = round(skill * 40), player rank 20.
  2. Offers: easy rivals all rank below the player; hard rivals all within the top 6; boss appears only at rank 1 and replaces hard.
  3. Payout math for a fixture result (2nd in medium with 1 wreck and 2 cash) = 700 + 375 + 400 = 1475 total, 4 points.
  4. Shop: buying engine level 1 for raven costs 300; level 6 returns `max`; insufficient cash returns `cash` and leaves save unchanged (deep equal).
  5. Repair cost for raven 37 hp = 148; Viper (tier 3) 10 hp = 96.
  10. Car shop lists exactly the `forSale` cars not owned (scorch, titan, viper at start); `buyCar('wraith')`, `buyCar('blaze')` return `invalid`.
  6. Save round-trip equals the original; corrupt JSON, wrong version, missing fields -> `loadSave` returns null.
  7. Purity: deep-freeze every input save (`Object.freeze` recursively) and run every function: no throw.
  8. Determinism: `simulateCareer(7, 'greedy')` twice -> identical runs.
  9. Rubber banding: `buildCareerRaceSetup` for a hard and a boss offer gives every AI entrant `rubberBand === 0`; for easy and medium it equals `profileForSkill(skill).rubberBand`.
- [ ] `careerSim` exposes at least two policies: `greedy` (always the highest tier it can place top 2 in, by a skill-vs-field model) and `safe` (always medium), with the player's effective skill modelled as `0.35 + 0.1 * avgUpgradeLevel + 0.15 * carTier` and repairs/upgrades bought by a fixed priority list (repair > engine > armor > tires > gun > next car when affordable with 1000 margin; "next car" = the cheapest `forSale` car of a higher tier than the current one, so it never swaps sideways and loses upgrades). Output: `{ races, champion: boolean, cashCurve: number[], rankCurve: number[] }`.

## Allowed deferrals
None.

## Out of scope
UI, persistence across devices, multiple save slots, sponsors, loans.
