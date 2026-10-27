# WP41 - Arena: last car standing (CCR-16)

**User request (2026-10-27), verbatim:** "top3 and 7 as a new mode in the menu (like a destruction derby thing)". Choice (user): "Last car standing": 8 cars in a closed arena, guns, mines, spikes and pickups; last car alive wins; after 2 minutes the arena starts hurting so it always ends; 3 arenas (scrapyard pit, quarry bowl, dock lot); a standalone menu mode, no career rewards. Genre reference: Mashed, Micro Machines battle, Destruction Derby.

Depends on: WP40 merged (menu and mode plumbing to follow). Read first: `SPEC.md`, `specs/contracts.ts`, `specs/content.md` sections 5-8 (weapons, pickups, race rules, AI), `src/sim/**` (world, vehicle, combat, race rules, ai.ts), `src/render` (track and theme building, how a TrackDef becomes walls and dressing), `src/content/tracks/**` (for the data style), the time trial mode added in WP40 (how a mode plugs into machine, title, HUD, results), `src/content/ai.ts` (the difficulty helper from WP38).
Owns: new arena content (`src/content/arenas/**`), arena rules in `src/sim` (new files plus the smallest hooks in the race loop), the arena behaviour in `src/sim/ai.ts` (a separate mode branch: racing behaviour must stay byte-identical, prove it with the soak), render support for arena layouts (new files plus minimal hooks), the ARENA menu entry, its setup and results screens, HUD changes for the mode, both contracts copies (CCR-16 only), tests, `specs/content.md` (a new "Arena" section), `docs/tuning-log.md`.
Dispatch: subagent (opus, effort high). Branch `wp/41-arena`, worktree `../wreckline-wt/wp41`, dev port 5241. The biggest of the four: if the arena geometry needs a contract change bigger than the one below, make the smallest one that works and explain it in the report.

## Design
- **Arenas (3):** closed play areas about 120-180 m across, outer wall plus 3-6 solid obstacles (container stacks, rock piles, crushed car cubes, a central island) so there is cover and chasing; themes `scrapyard`, `quarry`, `docks` with their existing dressing and props outside the wall. Data-driven like tracks. Choose the smallest geometry model that works with the existing wall and collider code (for example an outer closed polygon plus obstacle polygons) and justify it.
- **Rules:** 8 cars (player + 7 AI, AI skill 0.35-0.85 spread through the WP38 difficulty helper; AI cars a mix of the 8 models, player picks any car stock). Spawn points around the edge facing the centre, 3 s countdown. Guns, mines, spikes and turbo as in races (same weapon numbers); pickups (repair, mines, turbo, no cash) respawn 10 s after collection. A wrecked car is out. **Last car alive wins.** At 120 s "sudden death": every car loses 1% max hp per second and wall hits deal double damage, so it always ends (target: 90% of soak fights end by 180 s). Results: placement by elimination order (the winner 1st), wrecks caused, damage dealt.
- **AI arena behaviour:** choose a target (who damaged me recently, else the weakest or nearest in front), approach and line up the gun, ram with spikes when close and faster, drop mines when chased, go for a repair pickup under 35% hp, steer around obstacles and avoid hugging walls, never get stuck (reuse the stuck/reverse logic). It must be fun, not a pile-up in a corner: target a typical fight of 60-150 s with the player not always the first target (AI picks targets fairly, never all 7 on the player).
- **CCR-16 (pre-approved, smallest shape that works):** a mode marker on the setup (`'arena'`), an arena def type, result fields for elimination order and damage dealt. Deterministic sim stays deterministic.
- Menu: ARENA under TIME TRIAL. Setup: arena, car, START. No rewards, no save changes. Music: race tracks. Camera unchanged (follows the player; after the player is wrecked, spectate the leader or the last two cars, then results).

## Acceptance tests
- [ ] Unit: arena defs validate (no overlap, spawn points clear), sudden death damage, elimination order and placement, pickup respawn, AI target selection fairness (no more than 3 AIs on the same target over time in a soak).
- [ ] Arena soak (new, like `runSoak`): 16 seeds x 3 arenas, all fights end, median length 60-150 s, 90% end by 180 s, no stuck cars, report wrecks by weapon (gun / mine / ram / wall).
- [ ] Racing untouched: `node scripts/balance/run.mjs` identical numbers to main (8/8).
- [ ] Browser (screenshots 1280x720 into `../wreckline-wt/wp41-shots/`): each arena mid-fight, the sudden death indicator, results screen; a full fight with `autoplay=1` finishes; no console errors.
- [ ] `npm run verify` green; bundle budget figure.

## Out of scope
Career integration, rewards, online or local multiplayer, respawn modes, new weapons.
