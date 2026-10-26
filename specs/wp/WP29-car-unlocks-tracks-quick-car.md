# WP29 - Car unlocks by beating, all career tracks, quick race car pick

**User requests (2026-10-26), verbatim:**
- "I would like to add more tracks in the career mode. only 3 now"
- "when you beat one on the other type of car in a race, you can then unlock/buy it in the shop. Otherwise you can't. If you finish 1st, you unlock all cars you have beaten. All cars even boss car should then be available in shop to purshase when unlocked"
- "you can leave SCORCH, TITAN and VIPER unlocked by default in shop but cheaper when beaten" and "for the rest of the car, let's do what I said"
- "in quick race you should be able to choose your car and race"

Read first: `SPEC.md`, `specs/contracts.ts`, this file, `specs/content.md` sections 1, 3, 10, 11, `src/content/{cars,economy,quickRace}.ts`, `src/meta/{career,shop,save,careerSim}.ts` and their tests, `src/game/{settings,careerSession,index}.ts`, `src/ui/screens/PreRace.tsx`, `src/ui/screens/career/{Shop,CareerHub,Toast}.tsx`, `src/ui/fixtures.ts`.
Owns: `specs/contracts.ts` and `src/shared/contracts.ts` (CCR-10 below, both copies identical), `src/content/**`, `src/meta/**`, `src/game/**`, `src/ui/**`, `scripts/balance/**`, `specs/content.md`, `docs/tuning-log.md` (append). Not `src/render/**` (WP30 runs in parallel there).
Dispatch: subagent (opus, effort high).

## CCR-10 (apply to both contract copies, nothing else in them)
- `SaveGame.version: 3`, new field `beatenCars: string[]` (car def ids, each at most once, registry order not required). v2 saves migrate on load with `beatenCars: []`. Same migration style as v1 -> v2.
- `CarDef.forSale` comment: "listed in the shop from the start (scorch, titan, viper); other cars except the starter are listed once beaten (CCR-10)". `price` comment: "list price; trade-in base for every car".
- `Settings.quickCarId: string | null` next to `quickTrackId`: last car picked for quick race; null or unknown id = `raven`; `?race=1` ignores it. Defaults and load follow exactly what CCR-6 did for `quickTrackId` (no settings version bump unless that is how CCR-6 did it).

## Rules
1. **Beating a car type.** After every career race (any tier, boss included), every row of `RaceResult.rows` with a position after the player's row marks that row's `carDefId` as beaten (added to `save.beatenCars` if new). A win therefore beats every car type in the race. The boss row (THE WARDEN) counts like any rival: finishing ahead of it beats `wraith`. Quick race never changes the save.
2. **Shop listing (CARS tab).** Every car except `raven` gets a row:
   - `scorch`, `titan`, `viper` (`forSale: true`): always buyable. Price = list price, or `round(list * (1 - BEATEN_DISCOUNT))` once beaten. `BEATEN_DISCOUNT` = 0.25, a named constant in `src/content/economy.ts`.
   - `outlaw`, `iceberg`, `blaze`, `wraith` (`forSale: false`): shown locked (greyed, not buyable, text "Finish ahead of one in a race to unlock") until beaten, then buyable at list price (no discount: being beaten is what unlocks them).
   - The current car's row is not buyable (as today).
3. **Prices.** New list prices: outlaw 3500, iceberg 4500, blaze 10500, wraith 20000. scorch 6000, titan 9000, viper 12000 unchanged. raven stays 0 and never listed. Trade-in stays 50% of the current car's list price (with a 25% discount the cheapest buy is 75% of list, so no buy/sell profit loop; keep a test that proves it for every car).
4. **One price function** in `src/meta/shop.ts` (for example `carOffer(save, carDefId) -> { listed, locked, price, discounted }`) used by the shop logic, the Shop screen and `careerSim`, so the UI and the balance probe can never disagree.
5. **Career hub message.** After a race, one toast per newly beaten car type, using the existing one-time message path that showed "New track: <name>": "Unlocked in shop: <NAME>" for a locked car, "<NAME> now 25% off in the shop" for scorch/titan/viper. Nothing for the player's own car type or `raven`.
6. **Career tracks.** All 10 tracks are available from the first race: `TRACKS_AT_START` = 10 (the unlock code may stay; it then never adds a track). The per-offer track rotation formula in content.md section 11 is unchanged. No "New track" toast fires any more.
7. **Quick race car.** The pre-race screen gets a CAR picker row next to the TRACK picker, same look and controls (left/right, gamepad included), listing all 8 cars in registry order with the car name, stock spec (upgrades 0, quick race hp/mines/fuel as today), remembered in `settings.quickCarId`. `buildQuickRaceSetup` takes the car id. Quick race ignores unlocks and cash. AI cars in quick race are unchanged. Player livery color unchanged.
8. Update `specs/content.md` sections 1 (prices, forSale meaning), 3 (car row, discount, locked rows), 11 (all tracks from the start) with "(user decision 2026-10-26)". Append a `docs/tuning-log.md` entry with the before/after table.

## Balance
The greedy probe player in `careerSim` must follow the same rules through the shared price function (locked cars cannot be bought; discounts apply). Before WP29 (main): greedy champion in 22-38 races on 15/16 seeds. Run the same probe on the same seeds before and after your change and report both distributions (median, min, max, seeds outside 22-38). Target after: still >= 14/16 seeds inside 22-38. If it falls outside, do not tune anything: report the numbers and which purchases changed (the brain decides).

## Acceptance tests
- [ ] Unit: beat rule (positions behind the player only; win = all; boss row beats wraith; player wrecked still beats rows behind it; quick race never touches the save), v2 -> v3 migration, listing/lock/discount per car for an empty and a full `beatenCars`, no buy/sell profit loop, `buyCar` refuses a locked car.
- [ ] Unit: all 10 tracks unlocked for a new save; quickCarId default, persistence and unknown id fallback; quick race setup uses the picked car.
- [ ] Balance: probe before/after table as above.
- [ ] Browser (your dev server, see brief): new career shows offers on more than 3 different tracks over the first rounds; Shop CARS tab with locked and unlocked rows (use `?harness=ui&screen=shop` fixtures for locked/discounted states); win a career race with `autoplay=1` or a fixture and see the toast; quick race with BLAZE and WRAITH picked actually drives that car (car name on the pre-race screen and the car model in the race); no console errors. Screenshots into `../wreckline-wt/wp29-shots/`.
- [ ] `npm run verify` green; report bundle size.

## Out of scope
New tracks beyond the 10, rival car assignments, prices of upgrades or repairs, any render change.
