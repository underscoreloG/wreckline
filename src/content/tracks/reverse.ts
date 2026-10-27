/**
 * Reversed tracks (WP39, CCR-14): each track driven the other way, built from its def at load (no hand-drawn
 * copy). The centerline runs in the opposite order from a new start point; pickups keep their spot on the road
 * (s mirrored around the new start, lateral flipped since right is now left); props are world positions and stay
 * as they are; checkpoints and the grid come from buildTrackGeometry as for any track.
 *
 * The start: the forward start straight leads into T1, so driven the other way the grid behind the old line
 * would sit in that bend. The reversed line moves back along the same straight to GRID_DEPTH before its far end
 * in the new direction (the forward T1 entry), so the 8-car grid fills the straight and the cars get the rest of
 * it before the reversed T1 (REVERSED_START_S moves it where a track needs it). reverse.test.ts logs the numbers.
 */
import type { TrackDef, Vec2 } from '../../shared/contracts';
import { buildTrackGeometry } from '../../shared/trackGeometry';

export const REVERSED_SUFFIX = '~r';
/** m from the line to the back of the 8-car grid: the last slot 36 m behind the line, half a car and a margin. */
export const GRID_DEPTH = 40;
/** The straight of the start rule, as trackTestKit's longestStraight: |curvature| < 1/150 m. */
const STRAIGHT_K = 1 / 150;
/** m: an existing centerline point this close to the new start becomes the start as it is. */
const SNAP = 2;

/**
 * The 0.55 AI median clean lap of each reversed layout over the 16 soak seeds, rounded to 0.5 s (WP39,
 * measured by reverse.test.ts), keyed by the base track id.
 */
export const REVERSED_REFERENCE_LAP_TIMES: Readonly<Record<string, number>> = {
  scrapyard: 24.5,
  dustBowl: 23.5,
  dockside: 24.5,
  frostbite: 24,
  neonMile: 24.5,
  redrock: 23.5,
  junkyardSprint: 22,
  pineHollow: 24,
  rainDistrict: 24,
  blastPit: 27,
};

/**
 * Reversed line positions (forward s) that differ from the rule, keyed by the base track id (WP39). Scrapyard: the
 * rule's -7 left the 0.75 vs 0.35 AI finish spread at 0.797 (run.mjs, target >= 0.8); -10 gives 1.33. Frostbite: the
 * rule's -18 gave a 23.75 s median, on the 0.5 s rounding edge; -22 gives 23.80 s and fewer wall hits.
 */
export const REVERSED_START_S: Readonly<Partial<Record<string, number>>> = { scrapyard: -10, frostbite: -22 };

export const reversedId = (id: string): string => `${id}${REVERSED_SUFFIX}`;
export const isReversedId = (id: string): boolean => id.endsWith(REVERSED_SUFFIX);
/** The base track of a track id: 'scrapyard~r' and 'scrapyard' both give 'scrapyard'. */
export const baseTrackId = (id: string): string => (isReversedId(id) ? id.slice(0, -REVERSED_SUFFIX.length) : id);

/**
 * Forward s (negative = behind the forward line) of the reversed start line: GRID_DEPTH before the forward end of
 * the straight through (or ending at) the forward line. Throws when that straight cannot hold the grid.
 */
export function reversedStartS(def: TrackDef): number {
  const g = buildTrackGeometry(def);
  const n = g.samples.length;
  const ds = g.length / n;
  const straight = (i: number): boolean => Math.abs(g.samples[((i % n) + n) % n].curvature) < STRAIGHT_K;
  // End of the start straight: forward from the line when it sits on the straight, else the run just behind it.
  let end = 0;
  if (straight(0)) while (end < n && straight(end + 1)) end++;
  else while (end > -n && !straight(end)) end--;
  let from = end;
  while (from > end - n && straight(from - 1)) from--;
  const startS = end * ds - GRID_DEPTH;
  if (startS < from * ds) throw new Error(`track ${def.id}: start straight ${((end - from) * ds).toFixed(0)} m cannot hold the reversed grid`);
  return startS;
}

/** The track driven the other way (see the file comment); `startS` is the reversed line's forward s. */
export function reverseTrack(def: TrackDef, referenceLapTime: number, startS = reversedStartS(def)): TrackDef {
  const g = buildTrackGeometry(def);
  const length = g.length;
  const wrap = (s: number, l: number): number => ((s % l) + l) % l;
  const pts = def.centerline;
  const n = pts.length;
  // Forward s of each centerline point (the first one is the line, s 0), and the segment holding the new start.
  const sOf = pts.map((p, i) => (i === 0 ? 0 : g.project(p).s));
  const u = wrap(startS, length);
  let i = n - 1;
  while (i > 0 && sOf[i] > u) i--;
  const sNext = i + 1 < n ? sOf[i + 1] : length;
  let start: Vec2;
  let s0: number;
  let rest: Vec2[];
  // Backwards from the start: the points before it in forward order, then the ones after it.
  const back = (k: number): Vec2[] => [...pts.slice(0, k + 1).reverse(), ...pts.slice(k + 1).reverse()];
  if (u - sOf[i] <= SNAP || sNext - u <= SNAP) {
    const k = u - sOf[i] <= SNAP ? i : (i + 1) % n;
    [start, ...rest] = back(k);
    s0 = sOf[k];
  } else {
    // A new point on the forward spline: on the straight it barely moves the road (reverse.test.ts checks it).
    const p = g.sampleAt(u).pos;
    start = { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
    rest = back(i);
    s0 = u;
  }
  const centerline = [start, ...rest];
  const rLength = buildTrackGeometry({ ...def, centerline }).length;
  const pickups = def.pickups
    .map((p) => ({ ...p, s: wrap(Math.round(wrap(s0 - p.s, length) * 10) / 10, rLength), lateral: -p.lateral }))
    .sort((a, b) => a.s - b.s);
  return { ...def, id: reversedId(def.id), name: `${def.name} Reverse`, centerline, pickups, referenceLapTime };
}
