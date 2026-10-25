import type { TrackDef } from '../../shared/contracts';
import { DOCKSIDE } from './dockside';
import { DUST_BOWL } from './dustBowl';
import { SCRAPYARD } from './scrapyard';

export const TRACKS: Record<string, TrackDef> = {
  scrapyard: SCRAPYARD,
  dustBowl: DUST_BOWL,
  dockside: DOCKSIDE,
};

export const DEFAULT_TRACK_ID = 'scrapyard';

export function getTrack(id: string): TrackDef {
  const t = TRACKS[id];
  if (!t) throw new Error(`unknown track '${id}'`);
  return t;
}
