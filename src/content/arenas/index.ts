import type { ArenaDef, TrackDef } from '../../shared/contracts';
import { CHECKPOINT_SPACING } from '../race';
import { DOCK_LOT } from './dockLot';
import { QUARRY_BOWL } from './quarryBowl';
import { SCRAP_PIT } from './scrapPit';

/** WP41 (CCR-16): the arenas in menu order. */
export const ARENAS: Record<string, ArenaDef> = {
  scrapPit: SCRAP_PIT,
  quarryBowl: QUARRY_BOWL,
  dockLot: DOCK_LOT,
};

export const DEFAULT_ARENA_ID = 'scrapPit';

export function getArena(id: string): ArenaDef {
  const a = ARENAS[id];
  if (!a) throw new Error(`unknown arena '${id}'`);
  return a;
}

/** `id`'s arena, or the first for unknown ids. */
export const arenaOrFirst = (id: string | null | undefined): ArenaDef => (id && Object.hasOwn(ARENAS, id) ? (ARENAS[id] as ArenaDef) : getArena(DEFAULT_ARENA_ID));

/**
 * The TrackDef an arena fight runs on (CCR-16). Its centerline runs through the wall corners, so the track readers
 * (minimap outline, light pole aim, the ground under the renderer) see the arena. Width and shoulder are 0: the sim
 * builds the arena's own colliders instead of the track walls and keeps every car on the road surface. The pickups
 * only give the renderer its counts per kind: the sim places them at `arena.pickups[i].pos`.
 */
export function arenaTrack(arena: ArenaDef): TrackDef {
  return {
    id: arena.id,
    name: arena.name,
    theme: arena.theme,
    centerline: arena.wall,
    width: 0,
    shoulder: 0,
    checkpointSpacing: CHECKPOINT_SPACING,
    pickups: arena.pickups.map((p) => ({ kind: p.kind, s: 0, lateral: 0 })),
    props: arena.props,
    referenceLapTime: 0,
    arena,
  };
}
