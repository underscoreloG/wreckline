import { describe, expect, it } from 'vitest';
import type { ArenaDef } from '../../shared/contracts';
import { buildTrackGeometry } from '../../shared/trackGeometry';
import { ARENAS, arenaOrFirst, arenaTrack, DEFAULT_ARENA_ID } from './index';
import { ARENA_AI_SKILLS } from './rules';
import { buildArenaSetup } from './setup';
import { validateArena } from './validate';

describe('arena defs (WP41)', () => {
  it.each(Object.values(ARENAS).map((a) => [a.id, a] as const))('%s validates', (_id, a) => {
    const v = validateArena(a);
    expect(v.errors).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it('the validator catches a block on a spawn, a block against the wall, a prop inside and a cash pickup', () => {
    const base = ARENAS[DEFAULT_ARENA_ID] as ArenaDef;
    const s = base.spawns[0]!.pos;
    const bad: ArenaDef = {
      ...base,
      blocks: [
        ...base.blocks,
        { style: 'rocks', points: [{ x: s.x - 2, y: s.y - 2 }, { x: s.x + 2, y: s.y - 2 }, { x: s.x + 2, y: s.y + 2 }, { x: s.x - 2, y: s.y + 2 }] },
        { style: 'rocks', points: [{ x: 68, y: -2 }, { x: 72, y: -2 }, { x: 72, y: 2 }, { x: 68, y: 2 }] },
      ],
      pickups: [...base.pickups, { kind: 'cash', pos: { x: 0, y: -30 } }],
      props: [...base.props, { kind: 'crate', pos: { x: 0, y: -50 }, rotation: 0, scale: 1 }],
    };
    const errors = validateArena(bad).errors.join('\n');
    expect(errors).toMatch(/spawn 0 has -?[\d.]+ m of clearance/);
    expect(errors).toMatch(/from the wall, needs 10/);
    expect(errors).toMatch(/is cash/);
    expect(errors).toMatch(/inside the wall/);
  });

  it('arenaTrack carries the def, builds a geometry round the wall and keeps the pickup counts', () => {
    for (const a of Object.values(ARENAS)) {
      const t = arenaTrack(a);
      expect(t.arena).toBe(a);
      expect(t.theme).toBe(a.theme);
      expect(t.pickups.map((p) => p.kind)).toEqual(a.pickups.map((p) => p.kind));
      const g = buildTrackGeometry(t);
      expect(g.length).toBeGreaterThan(300);
    }
    expect(arenaOrFirst('nope').id).toBe(DEFAULT_ARENA_ID);
  });

  it('buildArenaSetup: 8 stock cars, 7 AI with the 0.35-0.85 skills, 7 distinct AI models shuffled per seed', () => {
    const s = buildArenaSetup({ seed: 7, arenaId: 'quarryBowl', carId: 'titan' });
    expect(s.mode).toBe('arena');
    expect(s.track.arena?.id).toBe('quarryBowl');
    expect(s.entrants).toHaveLength(8);
    expect(s.entrants[0]?.ai).toBeNull();
    expect(s.entrants[0]?.carDefId).toBe('titan');
    expect(s.entrants.slice(1).map((e) => e.ai?.skill)).toEqual(ARENA_AI_SKILLS);
    const models = s.entrants.slice(1).map((e) => e.carDefId);
    expect(new Set(models).size).toBe(7);
    expect(new Set(s.entrants.map((e) => e.color)).size).toBe(8);
    const other = buildArenaSetup({ seed: 8, arenaId: 'quarryBowl' }).entrants.slice(1).map((e) => e.carDefId);
    expect(other).not.toEqual(models);
    expect(buildArenaSetup({ seed: 1, autoplay: true }).entrants[0]?.ai).not.toBeNull();
  });
});
