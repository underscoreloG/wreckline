import type { TrackDef } from '../../shared/contracts';
import { SCRAPYARD } from './scrapyard';

export const TRACKS: Record<string, TrackDef> = {
  scrapyard: SCRAPYARD,
};

export const DEFAULT_TRACK_ID = 'scrapyard';

export function getTrack(id: string): TrackDef {
  const t = TRACKS[id];
  if (!t) throw new Error(`unknown track '${id}'`);
  return t;
}
