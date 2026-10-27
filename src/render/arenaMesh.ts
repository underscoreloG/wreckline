import * as THREE from 'three';
import { centroid, pointInPolygon } from '../content/arenas/geometry';
import type { ArenaBlock, ArenaDef, Vec2 } from '../shared/contracts';
import { createRng, hashString, type Rng } from '../shared/rng';
import { planArenaDressing } from './arenaDressing';
import { WALL_THICK } from './dressing';
import { buildDressing } from './dressingMesh';
import { boxNoBottom, merge, paint } from './geo';
import type { WorldTextures } from './textures';
import type { ThemeDef } from './themes';
import { clipHalfPlane, type TrackMesh } from './trackMesh';

// WP41: an arena instead of a track ribbon: ground, the floor inside the wall, the wall, the blocks, the WP27 dressing.
// Heights follow trackMesh: the floor sits at its shoulder height so the decal layers land on it.

const Y_GROUND = 0;
const Y_WATER = 0.006;
const Y_FLOOR = 0.012;
const GROUND_SIZE = 1200;
const GROUND_TILE_M = 6;
const FLOOR_TILE_M = 8;
const WALL_HEIGHT = 1.2;
const WALL_SECTION_M = 12;
const WATER_EDGE = 0.5;
// blocks
const CONTAINER_L = 6.1;
const CONTAINER_W = 2.6;
const CONTAINER_H = 2.6;
const CONTAINER_TIERS = 2;
const CONTAINER_EXTRA = ['#3E5F7A', '#4E6E3E', '#8A7A3A'] as const;
const CUBE = 1.8; // m, a crushed car
const CUBE_COLORS = ['#6A4430', '#5A5650', '#7A5A3A', '#46484C', '#5D6B78', '#7A3A32', '#8A8270'] as const;
const ROCK_COLOR = '#5B544C';
const ISLAND_HEIGHT = 1;
const CRATE = 1.4; // m, the crate prop's size: stacks on an island pad so it reads as solid

const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

/** Pushes quad a-b-c-d as 2 triangles wound so the face normal agrees with `n` (as trackMesh). */
function quad(out: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, n: THREE.Vector3): void {
  tmpA.subVectors(b, a);
  tmpB.subVectors(c, a);
  const ok = tmpA.cross(tmpB).dot(n) >= 0;
  for (const p of ok ? [a, b, c, a, c, d] : [a, c, b, a, d, c]) out.push(p.x, p.y, p.z);
}

const w3 = (p: Vec2, y: number): THREE.Vector3 => new THREE.Vector3(p.x, y, p.y);

function geometry(pos: number[], colors: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** Up-facing fan of a convex loop at height y, uv = world metres / tile. */
function fan(pts: readonly Vec2[], y: number, tile: number): THREE.BufferGeometry {
  const c = centroid(pts);
  const pos: number[] = [];
  const uv: number[] = [];
  const v = (p: Vec2): void => {
    pos.push(p.x, y, p.y);
    uv.push(p.x / tile, p.y / tile);
  };
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i] as Vec2;
    const b = pts[(i + 1) % pts.length] as Vec2;
    // Face up (+y): with three's z = sim y, a clockwise-on-screen loop needs c-b-a.
    const cw = (a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x) > 0;
    for (const p of cw ? [c, b, a] : [c, a, b]) v(p);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
}

/**
 * A band of `thick` m along a closed loop, `out` = +1 grows it away from the loop's centroid (the outer wall), -1
 * toward it (a block's rim). Inner face, top and outer face; sections alternate between two colors.
 */
function band(pts: readonly Vec2[], height: number, thick: number, out: 1 | -1, colA: string, colB: string, section: number): THREE.BufferGeometry {
  const c = centroid(pts);
  const pos: number[] = [];
  const col: number[] = [];
  const ca = new THREE.Color(colA);
  const cb = new THREE.Color(colB);
  const nrm = new THREE.Vector3();
  // Offset corners along the corner bisector so neighbouring edges meet.
  const off = pts.map((p) => {
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    return { x: p.x + ((p.x - c.x) / d) * thick * out, y: p.y + ((p.y - c.y) / d) * thick * out };
  });
  let run = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const a = pts[i] as Vec2;
    const b = pts[j] as Vec2;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.round(len / section));
    for (let k = 0; k < steps; k++) {
      const t0 = k / steps;
      const t1 = (k + 1) / steps;
      const lerp = (p: Vec2, q: Vec2, t: number): Vec2 => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      const i0 = lerp(a, b, t0);
      const i1 = lerp(a, b, t1);
      const o0 = lerp(off[i] as Vec2, off[j] as Vec2, t0);
      const o1 = lerp(off[i] as Vec2, off[j] as Vec2, t1);
      const mid = { x: (i0.x + i1.x) / 2, y: (i0.y + i1.y) / 2 };
      const away = { x: mid.x - c.x, y: mid.y - c.y };
      // The face on the loop line looks toward the centroid for the wall and away from it for a block.
      quad(pos, w3(i0, 0), w3(i1, 0), w3(i1, height), w3(i0, height), nrm.set(-away.x * out, 0, -away.y * out));
      quad(pos, w3(i0, height), w3(i1, height), w3(o1, height), w3(o0, height), UP);
      quad(pos, w3(o0, 0), w3(o1, 0), w3(o1, height), w3(o0, height), nrm.set(away.x * out, 0, away.y * out));
      const color = run++ % 2 === 0 ? ca : cb;
      for (let v = 0; v < 18; v++) col.push(color.r, color.g, color.b);
    }
  }
  return geometry(pos, col);
}

/** The block's long axis (its longest edge), for rows of containers and cubes. */
function axisOf(pts: readonly Vec2[]): { c: Vec2; u: Vec2; v: Vec2; hu: number; hv: number } {
  let best = 0;
  let u = { x: 1, y: 0 };
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i] as Vec2;
    const b = pts[(i + 1) % pts.length] as Vec2;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > best) {
      best = len;
      u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    }
  }
  const v = { x: -u.y, y: u.x };
  const c = centroid(pts);
  let hu = 0;
  let hv = 0;
  for (const p of pts) {
    hu = Math.max(hu, Math.abs((p.x - c.x) * u.x + (p.y - c.y) * u.y));
    hv = Math.max(hv, Math.abs((p.x - c.x) * v.x + (p.y - c.y) * v.y));
  }
  return { c, u, v, hu, hv };
}

/** One container: ridged box along local x, as the container prop. */
function container(color: string, x: number, y: number, z: number, rot: number): THREE.BufferGeometry {
  const segs = 14;
  const g = paint(new THREE.BoxGeometry(CONTAINER_L, CONTAINER_H, CONTAINER_W, segs, 1, 1), color);
  const p = g.getAttribute('position');
  const c = g.getAttribute('color') as THREE.BufferAttribute;
  for (let t = 0; t < p.count; t += 3) {
    const lx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3;
    const k = Math.floor(((lx + CONTAINER_L / 2) / CONTAINER_L) * segs) % 2 === 0 ? 1 : 0.8;
    for (let v = t; v < t + 3; v++) c.setXYZ(v, c.getX(v) * k, c.getY(v) * k, c.getZ(v) * k);
  }
  return g.rotateY(-rot).translate(x, y, z);
}

function containerStack(b: ArenaBlock, theme: ThemeDef, rng: Rng): THREE.BufferGeometry[] {
  const { c, u, v, hu, hv } = axisOf(b.points);
  const along = Math.max(1, Math.round((hu * 2) / CONTAINER_L));
  const across = Math.max(1, Math.round((hv * 2) / CONTAINER_W));
  const rot = Math.atan2(u.y, u.x);
  const colors = [...theme.propRust, ...CONTAINER_EXTRA];
  const out: THREE.BufferGeometry[] = [];
  for (let tier = 0; tier < CONTAINER_TIERS; tier++) {
    for (let i = 0; i < along; i++) {
      for (let j = 0; j < across; j++) {
        // The top tier is one short at a random end: a stack, not a block.
        if (tier > 0 && along > 1 && i === (rng.chance(0.5) ? 0 : along - 1) && rng.chance(0.6)) continue;
        const lu = -hu + ((i + 0.5) * hu * 2) / along;
        const lv = -hv + ((j + 0.5) * hv * 2) / across;
        const jitter = tier > 0 ? rng.range(-0.04, 0.04) : 0;
        out.push(container(rng.pick(colors), c.x + u.x * lu + v.x * lv, CONTAINER_H * (tier + 0.5), c.y + u.y * lu + v.y * lv, rot + jitter));
      }
    }
  }
  return out;
}

function cubePile(b: ArenaBlock, rng: Rng): THREE.BufferGeometry[] {
  const { c, u, v, hu, hv } = axisOf(b.points);
  const rot = Math.atan2(u.y, u.x);
  const out: THREE.BufferGeometry[] = [];
  const nu = Math.max(1, Math.floor((hu * 2) / CUBE));
  const nv = Math.max(1, Math.floor((hv * 2) / CUBE));
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const lu = -hu + CUBE * (i + 0.5) + (hu * 2 - nu * CUBE) / 2;
      const lv = -hv + CUBE * (j + 0.5) + (hv * 2 - nv * CUBE) / 2;
      const p = { x: c.x + u.x * lu + v.x * lv, y: c.y + u.y * lu + v.y * lv };
      if (!pointInPolygon(p, b.points)) continue;
      // Higher toward the middle of the pile.
      const centre = 1 - Math.max(Math.abs(lu) / hu, Math.abs(lv) / hv);
      const tiers = 1 + (rng.chance(0.3 + centre) ? 1 : 0) + (centre > 0.5 && rng.chance(0.5) ? 1 : 0);
      for (let t = 0; t < tiers; t++) {
        const s = CUBE * rng.range(0.88, 0.98);
        const h = s * rng.range(0.75, 0.9);
        const g = paint(boxNoBottom(s, h, s), rng.pick(CUBE_COLORS), rng.range(0.8, 1.05));
        out.push(g.rotateY(-rot + rng.range(-0.15, 0.15)).translate(p.x, h / 2 + t * CUBE * 0.82, p.y));
      }
    }
  }
  return out;
}

function rockPile(b: ArenaBlock, rng: Rng): THREE.BufferGeometry[] {
  const c = centroid(b.points);
  const r = Math.max(...b.points.map((p) => Math.hypot(p.x - c.x, p.y - c.y)));
  const out: THREE.BufferGeometry[] = [];
  const rock = (x: number, y: number, size: number): void => {
    const g = new THREE.IcosahedronGeometry(size, 0);
    const p = g.getAttribute('position');
    const k = new Map<string, number>();
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      if (!k.has(key)) k.set(key, rng.range(0.75, 1.15));
      const f = k.get(key) as number;
      p.setXYZ(i, p.getX(i) * f, Math.max(-0.2 * size, p.getY(i) * f * 0.7), p.getZ(i) * f);
    }
    g.computeVertexNormals();
    out.push(paint(g.translate(x, size * 0.45, y), ROCK_COLOR, rng.range(0.85, 1.15)));
  };
  rock(c.x, c.y, r * 0.62);
  for (const p of b.points) rock(p.x + (c.x - p.x) * 0.3, p.y + (c.y - p.y) * 0.3, r * rng.range(0.32, 0.42));
  return out;
}

export function buildArenaMesh(arena: ArenaDef, theme: ThemeDef, tex: WorldTextures): TrackMesh {
  const group = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, cast = false): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    m.castShadow = cast;
    group.add(m);
    return m;
  };
  const c = centroid(arena.wall);
  const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE).rotateX(-Math.PI / 2).translate(c.x, Y_GROUND, c.y);
  tex.ground.repeat.set(GROUND_SIZE / GROUND_TILE_M, GROUND_SIZE / GROUND_TILE_M);
  add(groundGeo, new THREE.MeshStandardMaterial({ map: tex.ground, roughness: 0.95 }));

  if (theme.water) {
    const h = GROUND_SIZE / 2;
    const square = [
      { x: c.x - h, y: c.y - h },
      { x: c.x + h, y: c.y - h },
      { x: c.x + h, y: c.y + h },
      { x: c.x - h, y: c.y + h },
    ];
    const { poly, cut } = clipHalfPlane(square, theme.water.point, theme.water.normal);
    if (poly.length >= 3) {
      const g = new THREE.ShapeGeometry(new THREE.Shape(poly.map((q) => new THREE.Vector2(q.x, q.y))));
      g.rotateX(Math.PI / 2);
      g.translate(0, Y_WATER, 0);
      add(g, new THREE.MeshStandardMaterial({ color: theme.water.color, roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide }));
    }
    if (cut.length === 2) {
      const [a, b] = cut as [Vec2, Vec2];
      const edge = new THREE.PlaneGeometry(Math.hypot(b.x - a.x, b.y - a.y), WATER_EDGE).rotateX(-Math.PI / 2);
      edge.rotateY(-Math.atan2(b.y - a.y, b.x - a.x));
      edge.translate((a.x + b.x) / 2, Y_WATER + 0.002, (a.y + b.y) / 2);
      add(edge, new THREE.MeshStandardMaterial({ color: theme.asphaltLine, roughness: 0.8 }));
    }
  }

  // The dirt texture is plain noise (the asphalt has lane lines), so it tiles over the whole floor.
  add(fan(arena.wall, Y_FLOOR, FLOOR_TILE_M), new THREE.MeshStandardMaterial({ map: tex.dirt, roughness: 0.95 }));

  const vc = { vertexColors: true, flatShading: true } as const;
  const rng = createRng(hashString(`${arena.id}/blocks`));
  const solid: THREE.BufferGeometry[] = [band(arena.wall, WALL_HEIGHT, WALL_THICK, 1, theme.wall, theme.tireWall, WALL_SECTION_M)];
  for (const b of arena.blocks) {
    if (b.style === 'containers') solid.push(...containerStack(b, theme, rng));
    else if (b.style === 'cubes') solid.push(...cubePile(b, rng));
    else if (b.style === 'rocks') solid.push(...rockPile(b, rng));
    else {
      // A raised pad: striped kerb rim, then the ground on top.
      solid.push(band(b.points, ISLAND_HEIGHT, 0.8, -1, theme.kerbA, theme.kerbB, 2));
      const inner = b.points.map((p) => {
        const cb = centroid(b.points);
        const d = Math.hypot(p.x - cb.x, p.y - cb.y);
        return { x: p.x - ((p.x - cb.x) / d) * 0.8, y: p.y - ((p.y - cb.y) / d) * 0.8 };
      });
      const top = fan(inner, ISLAND_HEIGHT - 0.05, GROUND_TILE_M);
      top.deleteAttribute('uv');
      solid.push(paint(top, theme.ground, 1.1));
      const { c: ic, u, v, hu, hv } = axisOf(inner);
      for (const [a, bb, tiers] of [[-0.45, -0.4, 2], [0.4, -0.35, 1], [-0.3, 0.45, 1], [0.35, 0.4, 3]] as const) {
        for (let t = 0; t < tiers; t++) {
          const x = ic.x + u.x * a * hu + v.x * bb * hv;
          const y = ic.y + u.y * a * hu + v.y * bb * hv;
          solid.push(paint(boxNoBottom(CRATE, CRATE, CRATE), theme.propRust[1], rng.range(0.8, 1.1)).rotateY(rng.range(-0.3, 0.3)).translate(x, ISLAND_HEIGHT + CRATE * (t + 0.5), y));
        }
      }
    }
  }
  add(merge(solid), new THREE.MeshStandardMaterial({ ...vc, roughness: 0.8, metalness: 0.05 }), true);
  group.add(buildDressing(theme, planArenaDressing(arena, theme.dressing), tex));

  // No start gantry: the countdown is the HUD's.
  return { group, setLamps: () => {} };
}
