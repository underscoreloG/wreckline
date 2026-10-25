# WP18 - Career soft-lock fix (free tow, partial repair)

**Wave C2, before the v0.3.0 release.** WP10 found that a wrecked car (0 hp) with too little cash for a full repair can never race again. The user chose (2026-10-25): a free tow to 30% hp when the player is stuck, plus partial repairs in the garage.
Read first: `specs/content.md` section 3 (repair, partial repair, free tow rows), `specs/wp/WP09-career-logic.md`, `specs/wp/WP10-career-ui.md`, then `src/meta/shop.ts`, `src/meta/career.ts`, `src/game/careerSession.ts`, `src/ui/screens/career/Garage.tsx`, `src/content/economy.ts` (`repairCost`).
Owns: `src/meta/shop.ts` (+ test), `src/game/careerSession.ts` (+ test), `src/ui/screens/career/Garage.tsx`, `src/ui/fixtures.ts` (garage fixtures only). Anything else needs a CCR.
Dispatch: subagent (opus, effort high).

## Deliverables
- `src/meta/shop.ts`: `freeTowIfStuck(save): { save: SaveGame; towed: boolean }` (pure): when `hp <= 0` and `cash < repairCost(car, ceil(0.3 * maxHp))`, set `hp = ceil(0.3 * maxHp)` at no cost; otherwise unchanged. The tow threshold (0.3) is a named constant in `src/content/economy.ts` style but lives in shop.ts as `TOW_HP_FRACTION` (WP12 may tune it there).
- `src/game/careerSession.ts`: apply `freeTowIfStuck` after every race result, every shop action and on career load; when `towed`, persist and show the toast "Towed: free repair to 30%" (kind `info`).
- `Garage.tsx`: next to REPAIR (full), add REPAIR +25% (of maxHp, clamped to missing hp) and REPAIR MAX (all hp the current cash pays for; hidden when it equals full or zero). Each shows its cost; unaffordable ones stay focusable and give the existing "Not enough cash" toast and error sound. Keep the compact layout (the user dislikes clutter): one row of three buttons.

## Acceptance tests
- [ ] `npm test -- meta`: tow at hp 0 / cash 0 -> hp ceil(0.3 maxHp), cash unchanged, towed true; hp 0 with enough cash for 30% -> unchanged, towed false; hp > 0 -> unchanged; purity (frozen input).
- [ ] `npm test -- game`: a career where the player is wrecked with cash 0 can select an offer and start the next race after the tow; partial repair +25% and MAX charge the right amounts.
- [ ] Browser (`preview_start` on your `wreckline-wp18` entry, `?autopause=0`): new career, set the save to hp 0 / cash 0 through the store or a fixture, open the hub: toast "Towed: free repair to 30%" and hp shows 30%; garage shows the three repair buttons with costs; screenshot.
- [ ] `npm run verify` green.

## Out of scope
Economy values (WP12), new SaveGame fields, other screens.
