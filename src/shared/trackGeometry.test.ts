import { describe, expect, it } from 'vitest';
import type { TrackDef } from './contracts';
import { createRng } from './rng';
import { buildTrackGeometry, validateTrack } from './trackGeometry';
import { SCRAPYARD } from '../content/tracks/scrapyard';

function circleTrack(): TrackDef {
  const centerline = [];
  for (let k = 0; k < 24; k++) {
    // Increasing angle with +y down = clockwise on screen.
    const a = (k / 24) * Math.PI * 2;
    centerline.push({ x: 100 * Math.cos(a), y: 100 * Math.sin(a) });
  }
  return {
    id: 'circle',
    name: 'Circle',
    theme: 'scrapyard',
    centerline,
    width: 14,
    shoulder: 2,
    checkpointSpacing: 40,
    pickups: [],
    props: [],
    referenceLapTime: 30,
  };
}

const sDiff = (a: number, b: number, length: number) => {
  const d = Math.abs(a - b) % length;
  return Math.min(d, length - d);
};

describe('trackGeometry', () => {
  const circle = buildTrackGeometry(circleTrack());

  it('circle length within 0.5% of 2*PI*r', () => {
    expect(Math.abs(circle.length - 2 * Math.PI * 100) / (2 * Math.PI * 100)).toBeLessThan(0.005);
    expect(circle.samples.length).toBe(Math.round(circle.length));
  });

  it('circle curvature is +1/100 within 5% (clockwise on screen = right turn)', () => {
    for (const smp of circle.samples) {
      expect(smp.curvature).toBeGreaterThan(0);
      expect(Math.abs(smp.curvature - 0.01) / 0.01).toBeLessThan(0.05);
    }
  });

  it('right = (-t.y, t.x) and points outward on a clockwise circle', () => {
    for (const smp of circle.samples) {
      expect(smp.right.x).toBeCloseTo(-smp.tangent.y, 12);
      expect(smp.right.y).toBeCloseTo(smp.tangent.x, 12);
    }
    // A right turn bends toward the right side: the circle centre is on the right.
    const s0 = circle.samples[0];
    expect(s0.right.x * (0 - s0.pos.x) + s0.right.y * (0 - s0.pos.y)).toBeGreaterThan(0);
  });

  it('project of every sample pos returns its s within 0.5 m', () => {
    for (const g of [circle, buildTrackGeometry(SCRAPYARD)]) {
      for (const smp of g.samples) {
        const pr = g.project(smp.pos);
        expect(sDiff(pr.s, smp.s, g.length)).toBeLessThan(0.5);
        expect(Math.abs(pr.lateral)).toBeLessThan(0.05);
      }
    }
  });

  it('Into variants equal the allocating ones and reuse out', () => {
    const g = buildTrackGeometry(SCRAPYARD);
    const rng = createRng(5);
    const outS = { s: 0, pos: { x: 0, y: 0 }, tangent: { x: 0, y: 0 }, right: { x: 0, y: 0 }, curvature: 0 };
    const outP = { s: 0, lateral: 0, sample: { s: 0, pos: { x: 0, y: 0 }, tangent: { x: 0, y: 0 }, right: { x: 0, y: 0 }, curvature: 0 } };
    const innerSample = outP.sample;
    const innerPos = outP.sample.pos;
    for (let i = 0; i < 1000; i++) {
      const s = rng.range(-2000, 3000);
      const a = g.sampleAt(s);
      const b = g.sampleAtInto(outS, s);
      expect(b).toBe(outS);
      expect(b).toEqual(a);
      const p = { x: rng.range(-120, 230), y: rng.range(-20, 320) };
      const hint = rng.chance(0.5) ? rng.range(0, g.length) : undefined;
      const pa = g.project(p, hint);
      const pb = g.projectInto(outP, p, hint);
      expect(pb).toBe(outP);
      expect(pb.sample).toBe(innerSample);
      expect(pb.sample.pos).toBe(innerPos);
      expect(pb).toEqual(pa);
    }
  });

  it('sampleAt wraps s and stays in [0, length)', () => {
    const g = circle;
    expect(g.sampleAt(g.length + 5).s).toBeCloseTo(5, 6);
    expect(g.sampleAt(-5).s).toBeCloseTo(g.length - 5, 6);
    const a = g.sampleAt(10);
    const b = g.sampleAt(10 + 3 * g.length);
    expect(b.pos.x).toBeCloseTo(a.pos.x, 6);
    expect(b.pos.y).toBeCloseTo(a.pos.y, 6);
  });

  it('projection is consistent with and without a hint near the line', () => {
    const g = buildTrackGeometry(SCRAPYARD);
    const rng = createRng(11);
    for (let i = 0; i < 1000; i++) {
      const smp = g.sampleAt(rng.range(0, g.length));
      const lat = rng.range(-g.def.width / 2 - g.def.shoulder, g.def.width / 2 + g.def.shoulder);
      const p = { x: smp.pos.x + smp.right.x * lat, y: smp.pos.y + smp.right.y * lat };
      const hint = smp.s + rng.range(-10, 10);
      const a = g.project(p);
      const b = g.project(p, hint);
      expect(sDiff(a.s, b.s, g.length)).toBeLessThan(1e-6);
      expect(b.lateral).toBeCloseTo(a.lateral, 6);
      expect(sDiff(a.s, smp.s, g.length)).toBeLessThan(1.5);
      expect(Math.abs(a.lateral - lat)).toBeLessThan(0.5);
    }
  });

  it('grid has 8 slots, all on the road, behind the line, pole first', () => {
    for (const g of [circle, buildTrackGeometry(SCRAPYARD)]) {
      expect(g.grid).toHaveLength(8);
      const ss = g.grid.map((slot) => {
        const pr = g.project(slot.pos);
        expect(Math.abs(pr.lateral)).toBeLessThan(g.def.width / 2);
        expect(Math.abs(Math.cos(slot.heading - Math.atan2(pr.sample.tangent.y, pr.sample.tangent.x)))).toBeGreaterThan(0.99);
        return pr.s;
      });
      expect(ss[0]).toBeCloseTo(g.length - 8, 0);
      for (let k = 1; k < 8; k++) expect(ss[k]).toBeLessThan(ss[k - 1]);
    }
  });

  it('checkpoints span wall to wall, gate 0 at the start line', () => {
    const g = buildTrackGeometry(SCRAPYARD);
    expect(g.checkpoints[0].s).toBe(0);
    for (const cp of g.checkpoints) {
      expect(Math.hypot(cp.a.x - cp.b.x, cp.a.y - cp.b.y)).toBeCloseTo(g.def.width + 2 * g.def.shoulder, 6);
    }
  });

  it('Scrapyard validates ok with length 1049 +- 5 and 26 checkpoints', () => {
    const v = validateTrack(SCRAPYARD);
    expect(v.errors).toEqual([]);
    expect(v.ok).toBe(true);
    expect(Math.abs(v.length - 1049)).toBeLessThanOrEqual(5);
    expect(v.minRadius).toBeGreaterThan(SCRAPYARD.width);
    expect(buildTrackGeometry(SCRAPYARD).checkpoints).toHaveLength(26);
  });

  it('validateTrack reports each rule', () => {
    const tiny = { ...circleTrack(), centerline: circleTrack().centerline.map((p) => ({ x: p.x * 0.5, y: p.y * 0.5 })) };
    expect(validateTrack(tiny).errors.some((e) => e.includes('length'))).toBe(true);
    const bad: TrackDef = {
      ...circleTrack(),
      pickups: [
        { kind: 'cash', s: 10, lateral: 6 },
        { kind: 'cash', s: 5000, lateral: 0 },
      ],
      props: [
        { kind: 'crate', pos: { x: 100, y: 0 }, rotation: 0, scale: 1 },
        { kind: 'crate', pos: { x: 0, y: 0 }, rotation: 0, scale: 1 },
        { kind: 'crate', pos: { x: 0.5, y: 0 }, rotation: 0, scale: 1 },
      ],
    };
    const v = validateTrack(bad);
    expect(v.ok).toBe(false);
    expect(v.errors.filter((e) => e.startsWith('pickup'))).toHaveLength(2);
    expect(v.errors.some((e) => e.startsWith('prop 0'))).toBe(true);
    expect(v.errors.some((e) => e.includes('overlap'))).toBe(true);
  });
});
