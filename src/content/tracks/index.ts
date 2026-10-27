import type { TrackDef } from '../../shared/contracts';
import { BLAST_PIT } from './blastPit';
import { DOCKSIDE } from './dockside';
import { DUST_BOWL } from './dustBowl';
import { FROSTBITE } from './frostbite';
import { JUNKYARD_SPRINT } from './junkyardSprint';
import { NEON_MILE } from './neonMile';
import { PINE_HOLLOW } from './pineHollow';
import { RAIN_DISTRICT } from './rainDistrict';
import { REDROCK } from './redrock';
import { REVERSED_REFERENCE_LAP_TIMES, REVERSED_START_S, reversedId, reverseTrack } from './reverse';
import { SCRAPYARD } from './scrapyard';

export { baseTrackId, isReversedId, reversedId } from './reverse';

export const TRACKS: Record<string, TrackDef> = {
  scrapyard: SCRAPYARD,
  dustBowl: DUST_BOWL,
  dockside: DOCKSIDE,
  frostbite: FROSTBITE,
  neonMile: NEON_MILE,
  redrock: REDROCK,
  junkyardSprint: JUNKYARD_SPRINT,
  pineHollow: PINE_HOLLOW,
  rainDistrict: RAIN_DISTRICT,
  blastPit: BLAST_PIT,
};

/**
 * WP39 (CCR-14): every track driven the other way, id '<id>~r' (reverse.ts). Kept out of TRACKS, so the track
 * pickers, career unlocks and offer rotation list the 10 base tracks; a direction flag picks the variant.
 */
export const REVERSED_TRACKS: Record<string, TrackDef> = Object.fromEntries(
  Object.values(TRACKS).map((t) => [reversedId(t.id), reverseTrack(t, REVERSED_REFERENCE_LAP_TIMES[t.id] ?? t.referenceLapTime, REVERSED_START_S[t.id])]),
);

export const DEFAULT_TRACK_ID = 'scrapyard';

/** A base or reversed track by id. */
export function getTrack(id: string): TrackDef {
  const t = TRACKS[id] ?? REVERSED_TRACKS[id];
  if (!t) throw new Error(`unknown track '${id}'`);
  return t;
}

/** The base track `id` (a TRACKS key) in the given direction. */
export const trackVariant = (id: string, reversed: boolean): TrackDef => getTrack(reversed ? reversedId(id) : id);
