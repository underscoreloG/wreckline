import { beforeAll, describe, expect, it } from 'vitest';
import type { TrackDef } from '../../shared/contracts';
import { angleWrap } from '../../shared/math';
import { validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { DOCKSIDE, DOCKSIDE_CORNERS, DOCKSIDE_PROP_RULES, DOCKSIDE_SCATTER } from './dockside';
import { getTrack } from './index';
import { SCRAPYARD } from './scrapyard';
import { trackContentTests, windowHairpins } from './trackTestKit';

beforeAll(async () => {
  await initPhysics();
});

const count = (def: TrackDef, k: string) => def.props.filter((p) => p.kind === k).length;

/** Turn of each polygon corner in degrees (+ = right). */
const cornerTurns = (): number[] =>
  DOCKSIDE_CORNERS.map((v, i) => {
    const a = DOCKSIDE_CORNERS[(i - 1 + DOCKSIDE_CORNERS.length) % DOCKSIDE_CORNERS.length];
    const b = DOCKSIDE_CORNERS[(i + 1) % DOCKSIDE_CORNERS.length];
    return (angleWrap(Math.atan2(b.y - v.y, b.x - v.x) - Math.atan2(v.y - a.y, v.x - a.x)) * 180) / Math.PI;
  });

describe('dockside', () => {
  it('validates ok: length inside the WP32 budget (850-990 m), the same id, name, theme and width', () => {
    const v = validateTrack(DOCKSIDE);
    console.warn(`WP32 dockside: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, ${DOCKSIDE.props.length} props`);
    expect(v.errors).toEqual([]);
    expect(v.length).toBeGreaterThanOrEqual(850);
    expect(v.length).toBeLessThanOrEqual(990);
    expect(v.minRadius).toBeGreaterThanOrEqual(DOCKSIDE.width);
    expect(v.minRadius).toBeLessThan(25);
    expect([DOCKSIDE.id, DOCKSIDE.name, DOCKSIDE.theme, DOCKSIDE.width]).toEqual(['dockside', 'Dockside', 'docks', 13]);
    expect(getTrack(DOCKSIDE.id)).toBe(DOCKSIDE);
  });

  it('square 90-degree corners round the container stacks, a chicane and one hairpin', () => {
    const turns = cornerTurns();
    // The hairpin is two of the 90s back to back; the chicane is L 45 / R 90 / L 45.
    expect(turns.filter((t) => Math.abs(Math.abs(t) - 90) < 2).length).toBeGreaterThanOrEqual(14);
    expect(turns.filter((t) => Math.abs(t + 45) < 2)).toHaveLength(2);
    expect(windowHairpins(DOCKSIDE)).toHaveLength(1);
  });

  it('pickups: cash 4, mines 3, turbo 3, repair 2, half of them off the AI line band', () => {
    const k = (kind: string) => DOCKSIDE.pickups.filter((p) => p.kind === kind).length;
    expect([k('cash'), k('mines'), k('turbo'), k('repair')]).toEqual([4, 3, 3, 2]);
    // lateral 5 is outside racingLine's 4.9 m band (width / 2 - 1.6): the AI never steers for those.
    const off = DOCKSIDE.pickups.filter((p) => Math.abs(p.lateral) > DOCKSIDE.width / 2 - 1.6).length;
    expect(off).toBeGreaterThanOrEqual(4);
    expect(off).toBeLessThanOrEqual(8);
  });

  trackContentTests(DOCKSIDE, DOCKSIDE_PROP_RULES, DOCKSIDE_SCATTER, 'WP32');

  it('Dockside: containers, crates, barrels, cones and more light poles than Scrapyard', () => {
    for (const k of ['container', 'crate', 'barrel', 'cone']) expect(count(DOCKSIDE, k)).toBeGreaterThan(0);
    expect(count(DOCKSIDE, 'lightPole')).toBeGreaterThan(count(SCRAPYARD, 'lightPole'));
  });
});
