import { ARENA_SUDDEN_DEATH_AT } from '../content/arenas/rules';
import type { CarId, HudState, RaceSnapshot } from '../shared/contracts';
import { PLAYER_CAR_ID } from '../shared/contracts';

// WP41 (CCR-16): the arena fight's game-side bits: who the camera watches after the player's wreck, and the HUD readout.

/**
 * The car to watch once the player is wrecked: the one watched so far while it still runs, else the live leader
 * (the running car with the best position: the most hp). null while no other car runs.
 */
export function spectateTarget(snap: RaceSnapshot, current: CarId | null): CarId | null {
  const cur = current !== null ? snap.cars[current] : undefined;
  if (cur && !cur.wrecked) return cur.id;
  let best: CarId | null = null;
  let bestPos = Infinity;
  for (const c of snap.cars) {
    if (c.wrecked || c.id === PLAYER_CAR_ID || c.position >= bestPos) continue;
    best = c.id;
    bestPos = c.position;
  }
  return best;
}

/** HudState with the arena readout: cars left, the time to sudden death, the watched car. */
export function decorateArenaHud(hud: HudState, snap: RaceSnapshot, spectating: CarId | null): HudState {
  return {
    ...hud,
    arena: {
      alive: snap.cars.filter((c) => !c.wrecked).length,
      suddenDeathIn: snap.phase === 'countdown' ? ARENA_SUDDEN_DEATH_AT : Math.max(0, ARENA_SUDDEN_DEATH_AT - snap.time),
      spectating,
    },
  };
}
