import { describe, expect, it } from 'vitest';
import type { GhostPose } from '../shared/contracts';
import { decodePoses, encodePoses, ghostKey, GHOST_HZ, loadGhost, offerGhost, parseGhost, serializeGhost, type GhostLap } from './ghost';
import type { KeyValueStore } from './save';

const memStore = (): KeyValueStore & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return { map, get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v), remove: (k) => void map.delete(k) };
};

/** A 25 s lap at 20 Hz: a lap of a 300 m wide loop at up to 50 m/s, with a spin and a wall bounce in it. */
function lapPoses(): GhostPose[] {
  const out: GhostPose[] = [];
  for (let k = 0; k <= 25 * GHOST_HZ; k++) {
    const t = k / GHOST_HZ;
    const a = (t / 25) * Math.PI * 2;
    const bounce = k === 200 ? 1.5 : 0; // a 1.5 m jump in one sample
    out.push({ x: -120.37 + 150 * Math.cos(a) + bounce, y: 80.11 + 90 * Math.sin(a), heading: a + Math.PI / 2 + (k > 300 && k < 330 ? (k - 300) * 0.4 : 0) - 3 * Math.PI });
  }
  return out;
}

const angleErr = (a: number, b: number): number => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

describe('ghost codec', () => {
  it('round trips within 5 cm and 0.5 deg', () => {
    const poses = lapPoses();
    const back = decodePoses(encodePoses(poses));
    expect(back).toHaveLength(poses.length);
    let pos = 0;
    let deg = 0;
    poses.forEach((p, i) => {
      const q = back![i]!;
      pos = Math.max(pos, Math.hypot(p.x - q.x, p.y - q.y));
      deg = Math.max(deg, (angleErr(p.heading, q.heading) * 180) / Math.PI);
    });
    expect(pos).toBeLessThan(0.05);
    expect(deg).toBeLessThan(0.5);
    // Quantisation alone: 1 cm per axis at most, 0.09 deg.
    expect(pos).toBeLessThan(0.015);
    expect(deg).toBeLessThan(0.1);
  });

  it('stores about 2 kB per entry, so 160 entries stay well under 1 MB', () => {
    const lap: GhostLap = { time: 25, poses: lapPoses() };
    const size = serializeGhost(lap).length;
    expect(size).toBeLessThan(2300);
    expect(160 * size).toBeLessThan(400_000);
  });

  it('decodes nothing from garbage', () => {
    expect(decodePoses('not base64 !!')).toBeNull();
    expect(decodePoses('')).toBeNull();
    expect(decodePoses(btoa(String.fromCharCode(0x80)))).toBeNull(); // a varint cut short
    expect(decodePoses(btoa('\x02\x02'))).toBeNull(); // not whole poses
  });
});

describe('ghost storage', () => {
  it('keys per track, direction and car under a versioned prefix', () => {
    expect(ghostKey('scrapyard', 'raven')).toBe('wreckline.ghost.v1.scrapyard.fwd.raven');
    expect(ghostKey('scrapyard~r', 'raven')).toBe('wreckline.ghost.v1.scrapyard.rev.raven');
    const keys = new Set(['scrapyard', 'scrapyard~r', 'dockside'].flatMap((t) => ['raven', 'titan'].map((c) => ghostKey(t, c))));
    expect(keys.size).toBe(6);
  });

  it('replaces the best only on improvement', () => {
    const store = memStore();
    const key = ghostKey('dockside~r', 'viper');
    const lap = (time: number): GhostLap => ({ time, poses: lapPoses().slice(0, Math.floor(time * GHOST_HZ) + 1) });
    expect(offerGhost(store, key, lap(24))).toBe(true);
    expect(offerGhost(store, key, lap(24.5))).toBe(false);
    expect(offerGhost(store, key, lap(24))).toBe(false); // a tie keeps the first
    expect(loadGhost(store, key)?.time).toBe(24);
    expect(offerGhost(store, key, lap(23.25))).toBe(true);
    const best = loadGhost(store, key)!;
    expect(best.time).toBe(23.25);
    expect(best.poses).toHaveLength(lap(23.25).poses.length);
    expect(store.map.size).toBe(1);
  });

  it('ignores corrupt, older or inconsistent entries and a failing store', () => {
    const good = serializeGhost({ time: 2, poses: lapPoses().slice(0, 41) });
    expect(parseGhost(good)?.poses).toHaveLength(41);
    const bad = [
      null,
      '',
      '{',
      '[]',
      'null',
      JSON.stringify({ v: 0, t: 2, p: JSON.parse(good).p }), // older layout
      JSON.stringify({ v: 1, t: -1, p: JSON.parse(good).p }),
      JSON.stringify({ v: 1, t: 'x', p: JSON.parse(good).p }),
      JSON.stringify({ v: 1, t: 2, p: '%%%' }),
      JSON.stringify({ v: 1, t: 1, p: JSON.parse(good).p }), // 41 poses do not fit a 1 s lap
      JSON.stringify({ v: 1, t: 2, p: encodePoses(lapPoses().slice(0, 1)) }),
    ];
    for (const text of bad) expect(parseGhost(text)).toBeNull();

    const store = memStore();
    const key = ghostKey('scrapyard', 'raven');
    store.set(key, '{"v":1,"t":3,"p":"garbage');
    expect(loadGhost(store, key)).toBeNull();
    // A corrupt entry is replaced by the first good lap.
    expect(offerGhost(store, key, { time: 2, poses: lapPoses().slice(0, 41) })).toBe(true);
    const throwing: KeyValueStore = {
      get: () => {
        throw new Error('blocked');
      },
      set: () => {
        throw new Error('quota');
      },
      remove: () => {},
    };
    expect(loadGhost(throwing, key)).toBeNull();
    expect(offerGhost(throwing, key, { time: 2, poses: lapPoses().slice(0, 41) })).toBe(false);
  });
});
