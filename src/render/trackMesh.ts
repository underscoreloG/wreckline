import * as THREE from 'three';
import type { TrackGeometry, Vec2 } from '../shared/contracts';
import { boxNoBottom, merge, paint } from './geo';
import type { WorldTextures } from './textures';
import type { ThemeDef } from './themes';

// WP03 track numbers. Heights stack the flat layers without z-fighting at race camera distance.
const Y_GROUND = 0;
const Y_WATER = 0.006;
const Y_SHOULDER = 0.012;
const Y_ROAD = 0.02;
const Y_KERB = 0.03;
const Y_START = 0.034;
const TEXTURE_REPEAT_M = 8; // road and shoulder v = s / 8
const GROUND_SIZE = 1200;
const GROUND_TILE_M = 6;
const KERB_WIDTH = 1;
const KERB_CURVATURE = 1 / 40;
const KERB_STRIPE_M = 2;
const WALL_HEIGHT = 0.9;
const WALL_THICK = 0.6;
const WALL_SECTION_M = 24;
const WATER_EDGE = 0.5;
const GANTRY_HEIGHT = 6;
const GANTRY_COLOR = '#3A3D42';
const LAMP_COUNT = 5;
const LAMP_OFF = new THREE.Color(0.08, 0.08, 0.09);
const LAMP_RED = new THREE.Color(4, 0.08, 0.04);
const LAMP_GREEN = new THREE.Color(0.25, 3, 0.4);

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

/** Pushes quad a-b-c-d as 2 triangles wound so the face normal agrees with `n`. */
function quad(out: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, n: THREE.Vector3): void {
  tmpA.subVectors(b, a);
  tmpB.subVectors(c, a);
  const ok = tmpA.cross(tmpB).dot(n) >= 0;
  const pts = ok ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
  for (const p of pts) out.push(p.x, p.y, p.z);
}

function geometry(pos: number[], colors?: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

const UP = new THREE.Vector3(0, 1, 0);
const w3 = (p: Vec2, y: number): THREE.Vector3 => new THREE.Vector3(p.x, y, p.y);

/** Textured ribbon between two closed polylines, u = 0 on `a` and 1 on `b`, v = s / 8. */
function ribbon(track: TrackGeometry, a: Vec2[], b: Vec2[], y: number): { pos: number[]; uv: number[]; index: number[] } {
  const n = track.samples.length;
  const ds = track.length / n;
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i % n;
    pos.push(a[k].x, y, a[k].y, b[k].x, y, b[k].y);
    const v = (i * ds) / TEXTURE_REPEAT_M;
    uv.push(0, v, 1, v);
    if (i < n) {
      const o = i * 2;
      index.push(o, o + 1, o + 2, o + 2, o + 1, o + 3);
    }
  }
  // Wind every triangle to face up (left/right order depends on the track direction).
  const p = (j: number): THREE.Vector3 => new THREE.Vector3(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]);
  const n0 = new THREE.Vector3().subVectors(p(index[1]), p(index[0])).cross(new THREE.Vector3().subVectors(p(index[2]), p(index[0])));
  if (n0.y < 0) for (let t = 0; t < index.length; t += 3) [index[t + 1], index[t + 2]] = [index[t + 2], index[t + 1]];
  return { pos, uv, index };
}

function ribbonGeometry(parts: { pos: number[]; uv: number[]; index: number[] }[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (const r of parts) {
    const base = pos.length / 3;
    pos.push(...r.pos);
    uv.push(...r.uv);
    for (const i of r.index) index.push(i + base);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(index);
  return g;
}

function kerbs(track: TrackGeometry, theme: ThemeDef): THREE.BufferGeometry | null {
  const n = track.samples.length;
  const pos: number[] = [];
  const col: number[] = [];
  const ca = new THREE.Color(theme.kerbA);
  const cb = new THREE.Color(theme.kerbB);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const si = track.samples[i];
    const sj = track.samples[j];
    if (Math.abs(si.curvature) <= KERB_CURVATURE || Math.abs(sj.curvature) <= KERB_CURVATURE) continue;
    const c = Math.floor(si.s / KERB_STRIPE_M) % 2 === 0 ? ca : cb;
    for (const side of [-1, 1]) {
      const ei = side < 0 ? track.leftEdge[i] : track.rightEdge[i];
      const ej = side < 0 ? track.leftEdge[j] : track.rightEdge[j];
      const oi = { x: ei.x + si.right.x * side * KERB_WIDTH, y: ei.y + si.right.y * side * KERB_WIDTH };
      const oj = { x: ej.x + sj.right.x * side * KERB_WIDTH, y: ej.y + sj.right.y * side * KERB_WIDTH };
      quad(pos, w3(ei, Y_KERB), w3(ej, Y_KERB), w3(oj, Y_KERB), w3(oi, Y_KERB), UP);
      for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
  }
  return pos.length ? geometry(pos, col) : null;
}

function walls(track: TrackGeometry, theme: ThemeDef): THREE.BufferGeometry {
  const n = track.samples.length;
  const pos: number[] = [];
  const col: number[] = [];
  const cw = new THREE.Color(theme.wall);
  const ct = new THREE.Color(theme.tireWall);
  const nrm = new THREE.Vector3();
  for (const side of [-1, 1]) {
    const line = side < 0 ? track.leftWall : track.rightWall;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const si = track.samples[i];
      const sj = track.samples[j];
      const out = (p: Vec2, s: typeof si): Vec2 => ({ x: p.x + s.right.x * side * WALL_THICK, y: p.y + s.right.y * side * WALL_THICK });
      const ib = w3(line[i], 0);
      const jb = w3(line[j], 0);
      const it = w3(line[i], WALL_HEIGHT);
      const jt = w3(line[j], WALL_HEIGHT);
      const ot = w3(out(line[i], si), WALL_HEIGHT);
      const pt = w3(out(line[j], sj), WALL_HEIGHT);
      const ob = w3(out(line[i], si), 0);
      const pb = w3(out(line[j], sj), 0);
      // Inner face looks back at the road, outer face away from it.
      quad(pos, ib, jb, jt, it, nrm.set(-si.right.x * side, 0, -si.right.y * side));
      quad(pos, it, jt, pt, ot, UP);
      quad(pos, ob, pb, pt, ot, nrm.set(si.right.x * side, 0, si.right.y * side));
      const c = Math.floor(si.s / WALL_SECTION_M) % 2 === 0 ? cw : ct;
      for (let k = 0; k < 18; k++) col.push(c.r, c.g, c.b);
    }
  }
  return geometry(pos, col);
}

/** Ground polygon on the water side of the line (Sutherland-Hodgman against one half-plane), plus the line's ends. */
function clipHalfPlane(poly: Vec2[], p: Vec2, nrm: Vec2): { poly: Vec2[]; cut: Vec2[] } {
  const d = (q: Vec2): number => (q.x - p.x) * nrm.x + (q.y - p.y) * nrm.y;
  const out: Vec2[] = [];
  const cut: Vec2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = d(a);
    const db = d(b);
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      const x = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      out.push(x);
      cut.push(x);
    }
  }
  return { poly: out, cut };
}

export interface TrackMesh {
  group: THREE.Group;
  /** 0 = off, 3/2/1 = countdown steps (red lamps fill in), 'go' = all green. */
  setLamps(state: 0 | 1 | 2 | 3 | 'go'): void;
}

export function buildTrackMesh(track: TrackGeometry, theme: ThemeDef, tex: WorldTextures): TrackMesh {
  const group = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, cast = false): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    m.castShadow = cast;
    group.add(m);
    return m;
  };

  // Ground, centered on the track.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of track.samples) {
    minX = Math.min(minX, s.pos.x);
    maxX = Math.max(maxX, s.pos.x);
    minY = Math.min(minY, s.pos.y);
    maxY = Math.max(maxY, s.pos.y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE).rotateX(-Math.PI / 2).translate(cx, Y_GROUND, cy);
  tex.ground.repeat.set(GROUND_SIZE / GROUND_TILE_M, GROUND_SIZE / GROUND_TILE_M);
  add(groundGeo, new THREE.MeshStandardMaterial({ map: tex.ground, roughness: 0.95 }));

  if (theme.water) {
    const h = GROUND_SIZE / 2;
    const square = [
      { x: cx - h, y: cy - h },
      { x: cx + h, y: cy - h },
      { x: cx + h, y: cy + h },
      { x: cx - h, y: cy + h },
    ];
    const { poly, cut } = clipHalfPlane(square, theme.water.point, theme.water.normal);
    if (poly.length >= 3) {
      // Shape lives in XY; rotating +90 deg about X maps y -> z (sim y) but leaves the face pointing down, hence DoubleSide.
      const g = new THREE.ShapeGeometry(new THREE.Shape(poly.map((q) => new THREE.Vector2(q.x, q.y))));
      g.rotateX(Math.PI / 2);
      g.translate(0, Y_WATER, 0);
      add(g, new THREE.MeshStandardMaterial({ color: theme.water.color, roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide }));
    }
    if (cut.length === 2) {
      const [a, b] = cut;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const edge = new THREE.PlaneGeometry(len, WATER_EDGE).rotateX(-Math.PI / 2);
      edge.rotateY(-Math.atan2(b.y - a.y, b.x - a.x));
      edge.translate((a.x + b.x) / 2, Y_WATER + 0.002, (a.y + b.y) / 2);
      add(edge, new THREE.MeshStandardMaterial({ color: theme.asphaltLine, roughness: 0.8 }));
    }
  }

  add(ribbonGeometry([ribbon(track, track.leftEdge, track.rightEdge, Y_ROAD)]), new THREE.MeshStandardMaterial({ map: tex.asphalt, roughness: 0.85 }));
  add(
    ribbonGeometry([ribbon(track, track.leftWall, track.leftEdge, Y_SHOULDER), ribbon(track, track.rightEdge, track.rightWall, Y_SHOULDER)]),
    new THREE.MeshStandardMaterial({ map: tex.dirt, roughness: 0.95 }),
  );
  const vc = { vertexColors: true, flatShading: true } as const;
  const kerbGeo = kerbs(track, theme);
  if (kerbGeo) add(kerbGeo, new THREE.MeshStandardMaterial({ ...vc, roughness: 0.75 }));
  add(walls(track, theme), new THREE.MeshStandardMaterial({ ...vc, roughness: 0.8 }), true);

  // Start line: 2 rows of 1 m checks across the road at s = 0.
  const s0 = track.samples[0];
  const at = (s: number, lat: number, y: number): THREE.Vector3 =>
    new THREE.Vector3(s0.pos.x + s0.tangent.x * s + s0.right.x * lat, y, s0.pos.y + s0.tangent.y * s + s0.right.y * lat);
  const half = track.def.width / 2;
  const cols = Math.round(track.def.width);
  const pos: number[] = [];
  const col: number[] = [];
  for (let row = 0; row < 2; row++) {
    for (let c = 0; c < cols; c++) {
      const l0 = -half + (c * track.def.width) / cols;
      const l1 = -half + ((c + 1) * track.def.width) / cols;
      const a0 = -0.5 + row * 0.5;
      quad(pos, at(a0, l0, Y_START), at(a0 + 0.5, l0, Y_START), at(a0 + 0.5, l1, Y_START), at(a0, l1, Y_START), UP);
      const v = (row + c) % 2 === 0 ? 0.9 : 0.04;
      for (let k = 0; k < 6; k++) col.push(v, v, v);
    }
  }
  add(geometry(pos, col), new THREE.MeshStandardMaterial({ ...vc, roughness: 0.7 }));

  // Gantry: 2 posts just outside the walls, a beam, 5 lamps on the beam.
  const postLat = half + track.def.shoulder + WALL_THICK + 0.6;
  const rotY = -Math.atan2(s0.right.y, s0.right.x); // beam runs along the right vector
  const gantryParts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const p = at(0, side * postLat, GANTRY_HEIGHT / 2);
    gantryParts.push(paint(boxNoBottom(0.5, GANTRY_HEIGHT + 0.6, 0.5).translate(p.x, p.y, p.z), GANTRY_COLOR));
  }
  const beam = boxNoBottom(postLat * 2 + 0.5, 0.6, 0.6).rotateY(rotY);
  const bc = at(0, 0, GANTRY_HEIGHT);
  gantryParts.push(paint(beam.translate(bc.x, bc.y, bc.z), GANTRY_COLOR));
  const gantry = new THREE.Mesh(merge(gantryParts), new THREE.MeshStandardMaterial({ ...vc, roughness: 0.6, metalness: 0.3 }));
  gantry.castShadow = true;
  group.add(gantry);

  const lampParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < LAMP_COUNT; i++) {
    const p = at(-0.2, (i - (LAMP_COUNT - 1) / 2) * 1.4, GANTRY_HEIGHT + 0.5);
    lampParts.push(paint(boxNoBottom(0.55, 0.45, 0.55).translate(p.x, p.y, p.z), LAMP_OFF));
  }
  const lampGeo = merge(lampParts);
  const perLamp = lampGeo.getAttribute('position').count / LAMP_COUNT;
  const lampColors = lampGeo.getAttribute('color') as THREE.BufferAttribute;
  group.add(new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ vertexColors: true })));

  // Red lamps fill in from the outside pair to the center: 3 -> 2 lamps, 2 -> 4, 1 -> 5.
  const RED_ORDER = [0, 4, 1, 3, 2];
  const setLamps = (state: 0 | 1 | 2 | 3 | 'go'): void => {
    const red = state === 'go' || state === 0 ? 0 : [0, 5, 4, 2][state];
    for (let i = 0; i < LAMP_COUNT; i++) {
      const c = state === 'go' ? LAMP_GREEN : RED_ORDER.indexOf(i) < red ? LAMP_RED : LAMP_OFF;
      for (let v = i * perLamp; v < (i + 1) * perLamp; v++) lampColors.setXYZ(v, c.r, c.g, c.b);
    }
    lampColors.needsUpdate = true;
  };

  return { group, setLamps };
}
