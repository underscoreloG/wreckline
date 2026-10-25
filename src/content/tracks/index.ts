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
import { SCRAPYARD } from './scrapyard';

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

export const DEFAULT_TRACK_ID = 'scrapyard';

export function getTrack(id: string): TrackDef {
  const t = TRACKS[id];
  if (!t) throw new Error(`unknown track '${id}'`);
  return t;
}
