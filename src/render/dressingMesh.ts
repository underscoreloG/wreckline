import * as THREE from 'three';
import { createRng } from '../shared/rng';
import { BANNER_LEN, BARRIER, CLUTTER_RADIUS, NEON_SIZE, STAND, STAND_TIER_H, type Decal, type DressingPlan, type Placed, type Strip } from './dressing';
import { boxNoBottom, merge, paint } from './geo';
import { decalUv, type WorldTextures } from './textures';
import type { ThemeDef, ThemeDressing } from './themes';

// Decal layers sit just above the surface they dress (trackMesh: ground 0, shoulder 0.012, road 0.02, kerb 0.03).
const Y_DECAL = { ground: 0.004, shoulder: 0.016, road: 0.024 } as const;
const Y_SKID = 0.025;
const Y_GRID = 0.026;
const STEEL_DARK = '#2E3034';
const BANNER_TILT = (60 * Math.PI) / 180; // from vertical, leaning away from the road so the race camera sees it
const FLAG_POLE = 5.5;
const PUFFS = 3; // smoke sprites per vent
const PUFF_RISE = 7; // m over one cycle
const PUFF_PERIOD = 4; // s
const FIRE_COLOR = '#FF8A3A';
const FIRE_GLOW = 1.4; // HDR: a burning barrel is a light, it may bloom
const NEON_GLOW = 1.5;

/** Marks an object as high quality only (scene.applyQuality hides it at low). */
const highOnly = <T extends THREE.Object3D>(o: T): T => {
  o.userData.highOnly = true;
  return o;
};

const tmpColor = new THREE.Color();

/** Flat decal quads and ribbons in one geometry: position, up normal, atlas uv, RGBA tint. */
class DecalBuilder {
  pos: number[] = [];
  uv: number[] = [];
  col: number[] = [];

  private tri(a: number[], b: number[], c: number[], ua: number[], ub: number[], uc: number[], rgba: number[]): void {
    // Face up: cross(b - a, c - a).y > 0 with y = up and z = sim y.
    const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) > 0;
    const order: [number[], number[]][] = up ? [[a, ua], [b, ub], [c, uc]] : [[a, ua], [c, uc], [b, ub]];
    for (const [p, u] of order) {
      this.pos.push(p[0], p[1], p[2]);
      this.uv.push(u[0], u[1]);
      this.col.push(...rgba);
    }
  }

  quad(p: number[][], u: number[][], rgba: number[]): void {
    this.tri(p[0], p[1], p[2], u[0], u[1], u[2], rgba);
    this.tri(p[0], p[2], p[3], u[0], u[2], u[3], rgba);
  }

  decal(d: Decal, y: number): void {
    const [u0, v0, u1, v1] = decalUv(d.cell);
    const f = { x: Math.cos(d.rot) * (d.l / 2), y: Math.sin(d.rot) * (d.l / 2) };
    const r = { x: -Math.sin(d.rot) * (d.w / 2), y: Math.cos(d.rot) * (d.w / 2) };
    const pt = (sf: number, sr: number): number[] => [d.x + f.x * sf + r.x * sr, y, d.y + f.y * sf + r.y * sr];
    this.quad([pt(-1, -1), pt(-1, 1), pt(1, 1), pt(1, -1)], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], rgba(d.color, d.alpha));
  }

  strip(s: Strip, cell: Decal['cell'], y: number): void {
    const [u0, v0, u1, v1] = decalUv(cell);
    const n = s.points.length;
    const side = (k: number, sr: number): number[] => {
      const a = s.points[Math.max(0, k - 1)];
      const b = s.points[Math.min(n - 1, k + 1)];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const p = s.points[k];
      return [p.x - ((b.y - a.y) / len) * (s.width / 2) * sr, y, p.y + ((b.x - a.x) / len) * (s.width / 2) * sr];
    };
    const c = rgba(s.color, s.alpha);
    for (let k = 0; k < n - 1; k++) {
      const va = v0 + ((v1 - v0) * k) / (n - 1);
      const vb = v0 + ((v1 - v0) * (k + 1)) / (n - 1);
      this.quad([side(k, -1), side(k, 1), side(k + 1, 1), side(k + 1, -1)], [[u0, va], [u1, va], [u1, vb], [u0, vb]], c);
    }
  }

  mesh(tex: THREE.Texture): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(this.pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 4));
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, transparent: true, depthWrite: false, roughness: 0.9 }));
    m.receiveShadow = true;
    return m;
  }
}

function rgba(color: string, alpha: number): number[] {
  tmpColor.set(color);
  return [tmpColor.r, tmpColor.g, tmpColor.b, alpha];
}

function barrierGeometry(kind: ThemeDressing['barrier']): THREE.BufferGeometry {
  // Local x along the wall, -z toward the road; white parts take the instance tint.
  const { len, depth } = BARRIER[kind];
  switch (kind) {
    case 'tyres': {
      // Two tyres high, sides and top ring only (30 triangles): hundreds of these line a track.
      const r = depth / 2;
      return merge([
        paint(new THREE.CylinderGeometry(r, r, 0.6, 7, 1, true).translate(0, 0.3, 0), '#ffffff'),
        paint(new THREE.RingGeometry(r * 0.5, r, 7).rotateX(-Math.PI / 2).translate(0, 0.6, 0), '#ffffff'),
        paint(new THREE.CircleGeometry(r * 0.5, 7).rotateX(-Math.PI / 2).translate(0, 0.6, 0), '#101010'),
      ]);
    }
    case 'blocks':
      return merge([paint(boxNoBottom(len - 0.06, 0.4, depth).translate(0, 0.2, 0), '#ffffff'), paint(boxNoBottom(len - 0.06, 0.45, depth * 0.45).translate(0, 0.62, 0), '#e8e8e8')]);
    case 'rails':
      return merge([paint(boxNoBottom(0.12, 0.75, 0.12).translate(0, 0.375, 0.05), '#8a8a8a'), paint(boxNoBottom(len, 0.32, 0.08).translate(0, 0.55, -0.06), '#ffffff')]);
    case 'fence':
      return merge([
        paint(boxNoBottom(0.1, 1.2, 0.1).translate(-len / 2 + 0.05, 0.6, 0), '#bcbcbc'),
        ...[0.35, 0.7, 1.05].map((y) => paint(boxNoBottom(len, 0.14, 0.04).translate(0, y, 0), '#ffffff')),
      ]);
  }
}

/** One heap shape per theme, built from a fixed seed; instances vary it by rotation, scale and tint. */
function clutterGeometry(shape: NonNullable<ThemeDressing['clutter']>['shape']): THREE.BufferGeometry {
  const rng = createRng(0xc1a77e);
  const r = CLUTTER_RADIUS;
  const parts: THREE.BufferGeometry[] = [];
  switch (shape) {
    case 'scrap':
      // Flattened junk: plates, beams and a tyre, all low so nothing hides the road.
      for (let i = 0; i < 6; i++) {
        const b = boxNoBottom(rng.range(0.5, 1.8), rng.range(0.15, 0.6), rng.range(0.3, 1.2)).rotateZ(rng.range(-0.4, 0.4)).rotateY(rng.range(0, Math.PI));
        parts.push(paint(b.translate(rng.range(-r, r) * 0.5, rng.range(0.1, 0.5), rng.range(-r, r) * 0.5), rng.chance(0.5) ? '#ffffff' : '#bdbdbd'));
      }
      parts.push(paint(new THREE.CylinderGeometry(0.4, 0.4, 0.25, 7, 1, true).rotateZ(1.2).translate(r * 0.5, 0.35, 0), '#2a2a2a'));
      break;
    case 'rocks':
      for (let i = 0; i < 3; i++) parts.push(paint(new THREE.IcosahedronGeometry(rng.range(0.4, 0.9), 0).scale(1, 0.6, 1).translate(rng.range(-r, r) * 0.5, 0.2, rng.range(-r, r) * 0.5), i === 0 ? '#ffffff' : '#cfcfcf'));
      break;
    case 'crates':
      parts.push(paint(boxNoBottom(1.2, 0.9, 1.2).translate(-0.4, 0.45, 0), '#ffffff'), paint(boxNoBottom(1, 0.8, 1).rotateY(0.4).translate(0.6, 0.4, 0.3), '#d8d8d8'));
      parts.push(paint(boxNoBottom(1.2, 0.15, 1).translate(0.1, 0.075, -0.9), '#9a9a9a'));
      break;
    case 'mounds':
      parts.push(paint(new THREE.IcosahedronGeometry(1, 1).scale(r * 0.8, 0.45, r * 0.6), '#ffffff'));
      break;
  }
  return merge(parts);
}

function standGeometry(color: string): THREE.BufferGeometry {
  const tierD = STAND.depth / STAND.tiers;
  const parts: THREE.BufferGeometry[] = [];
  for (let t = 0; t < STAND.tiers; t++) {
    const h = STAND_TIER_H * (t + 1);
    parts.push(paint(boxNoBottom(STAND.len, h, tierD).translate(0, h / 2, -STAND.depth / 2 + tierD * (t + 0.5)), t % 2 === 0 ? color : tmpColor.set(color).multiplyScalar(0.85)));
  }
  parts.push(paint(boxNoBottom(STAND.len + 0.4, STAND_TIER_H * STAND.tiers + 1, 0.3).translate(0, (STAND_TIER_H * STAND.tiers + 1) / 2, STAND.depth / 2 + 0.15), STEEL_DARK));
  return merge(parts);
}

function crowdGeometry(): THREE.BufferGeometry {
  return merge([paint(boxNoBottom(0.5, 0.75, 0.36).translate(0, 0.375, 0), '#ffffff'), paint(boxNoBottom(0.24, 0.26, 0.24).translate(0, 0.9, 0), '#d8c4b0')]);
}

/** Upright panel turned to face the road (-z), then leaned back (top toward +z) so the near-top-down camera sees its face. */
const leaned = (w: number, h: number, y: number): THREE.BufferGeometry =>
  new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0).rotateY(Math.PI).rotateX(BANNER_TILT).translate(0, y, 0);

function bannerGeometry(): THREE.BufferGeometry {
  return merge([
    paint(leaned(BANNER_LEN, 0.3, 0.3), '#ffffff'),
    paint(leaned(BANNER_LEN, 0.3, 0.3).translate(0, Math.cos(BANNER_TILT) * 0.3, Math.sin(BANNER_TILT) * 0.3), '#5a5a5a'),
    paint(leaned(BANNER_LEN, 0.3, 0.3).translate(0, Math.cos(BANNER_TILT) * 0.6, Math.sin(BANNER_TILT) * 0.6), '#ffffff'),
    ...[-1, 1].map((sx) => paint(boxNoBottom(0.08, 0.9, 0.08).translate((sx * BANNER_LEN) / 2, 0.45, 0.2), STEEL_DARK)),
  ]);
}

function flagGeometry(): THREE.BufferGeometry {
  return merge([
    paint(new THREE.CylinderGeometry(0.05, 0.07, FLAG_POLE, 5).translate(0, FLAG_POLE / 2, 0), STEEL_DARK),
    paint(leaned(1.6, 1, FLAG_POLE - 1.1).translate(0.8, 0, 0), '#ffffff'),
  ]);
}

function instanced(geo: THREE.BufferGeometry, list: readonly Placed[], colorOf: (p: Placed) => THREE.ColorRepresentation, shadow: boolean): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, metalness: 0.1 }), list.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  list.forEach((p, i) => {
    q.setFromAxisAngle(yAxis, -p.rot);
    mesh.setMatrixAt(i, m4.compose(pos.set(p.x, p.h, p.y), q, scl.setScalar(p.scale)));
    mesh.setColorAt(i, tmpColor.set(colorOf(p)));
  });
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  return mesh;
}

/** Smoke or steam: additive sprites rising and fading over each vent, plus a fire glow on burning barrels. */
function vents(list: readonly Placed[], d: NonNullable<ThemeDressing['vent']>, glow: THREE.Texture, group: THREE.Group): void {
  const base = instanced(
    merge([paint(new THREE.CylinderGeometry(0.45, 0.45, 1, 9).translate(0, 0.5, 0), d.fire ? '#4A3020' : '#3A3C40'), paint(new THREE.CircleGeometry(0.4, 9).rotateX(-Math.PI / 2).translate(0, 1.01, 0), '#0A0A0A')]),
    list,
    () => '#ffffff',
    true,
  );
  group.add(base);
  const puffs = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    list.length * PUFFS,
  );
  const smoke = new THREE.Color(d.color);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const t0 = performance.now();
  const animate = (): void => {
    const t = (performance.now() - t0) / 1000 / PUFF_PERIOD;
    list.forEach((v, i) => {
      for (let k = 0; k < PUFFS; k++) {
        const p = (t + k / PUFFS + i * 0.37) % 1;
        q.setFromAxisAngle(yAxis, v.rot + p * 2);
        pos.set(v.x + p * 2.5, 1.2 + p * PUFF_RISE, v.y - p * 1.5);
        puffs.setMatrixAt(i * PUFFS + k, m4.compose(pos, q, scl.setScalar((2 + p * 5) * v.scale)));
        puffs.setColorAt(i * PUFFS + k, tmpColor.copy(smoke).multiplyScalar(0.5 * Math.sin(Math.PI * p)));
      }
    });
    puffs.instanceMatrix.needsUpdate = true;
    if (puffs.instanceColor) puffs.instanceColor.needsUpdate = true;
  };
  animate();
  puffs.onBeforeRender = animate;
  puffs.frustumCulled = false; // instances move every frame; the bounding sphere is never recomputed
  group.add(puffs);
  if (d.fire) {
    const fire = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(FIRE_COLOR).multiplyScalar(FIRE_GLOW), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      list.length,
    );
    list.forEach((v, i) => fire.setMatrixAt(i, m4.compose(pos.set(v.x, 1.05, v.y), q.identity(), scl.setScalar(v.scale))));
    group.add(fire);
  }
}

function neonGeometry(): THREE.BufferGeometry {
  // A sign frame outline and one bar, leaned like the banners; HDR vertex colors make it bloom.
  const s = NEON_SIZE;
  const bar = (w: number, h: number, x: number, y: number): THREE.BufferGeometry => leaned(w, h, 0).translate(x, 0, 0).translate(0, Math.cos(BANNER_TILT) * y + 0.6, Math.sin(BANNER_TILT) * y);
  return merge([bar(s, 0.15, 0, 0), bar(s, 0.15, 0, 1.6), bar(0.15, 1.75, -s / 2, 0), bar(0.15, 1.75, s / 2, 0), bar(s * 0.6, 0.2, 0, 0.8)].map((g) => paint(g, '#ffffff', NEON_GLOW)));
}

/** All WP27 dressing meshes for one track, from its plan (see dressing.ts). Kerbs stay in trackMesh. */
export function buildDressing(theme: ThemeDef, plan: DressingPlan, tex: WorldTextures): THREE.Group {
  const d = theme.dressing;
  const group = new THREE.Group();
  group.name = 'dressing';

  const surface = new DecalBuilder();
  for (const dc of plan.decals) if (dc.layer === 'shoulder') surface.decal(dc, Y_DECAL.shoulder);
  for (const dc of plan.decals) if (dc.layer === 'road' && dc.cell !== 'grid') surface.decal(dc, Y_DECAL.road);
  for (const s of plan.skids) surface.strip(s, 'skid', Y_SKID);
  for (const dc of plan.decals) if (dc.cell === 'grid') surface.decal(dc, Y_GRID);
  group.add(surface.mesh(tex.decals));

  const ground = new DecalBuilder();
  for (const dc of plan.decals) if (dc.layer === 'ground') ground.decal(dc, Y_DECAL.ground);
  group.add(highOnly(ground.mesh(tex.decals)));

  if (plan.clutter.length && d.clutter) {
    const cl = d.clutter;
    group.add(highOnly(instanced(clutterGeometry(cl.shape), plan.clutter, (p) => cl.colors[p.tint], true)));
  }
  if (plan.barriers.length) group.add(instanced(barrierGeometry(d.barrier), plan.barriers, (p) => d.barrierColors[p.tint], true));
  if (plan.stands.length) group.add(highOnly(instanced(standGeometry(theme.wall), plan.stands, () => '#ffffff', true)));
  if (plan.crowd.length) group.add(highOnly(instanced(crowdGeometry(), plan.crowd, (p) => d.crowd[p.tint], true)));
  if (plan.banners.length) group.add(highOnly(instanced(bannerGeometry(), plan.banners, (p) => d.banner[p.tint], false)));
  if (plan.flags.length) group.add(highOnly(instanced(flagGeometry(), plan.flags, (p) => d.banner[p.tint], true)));
  if (plan.vents.length && d.vent) {
    const g = highOnly(new THREE.Group());
    vents(plan.vents, d.vent, tex.glow, g);
    group.add(g);
  }
  if (plan.neon.length && d.neon) {
    const neon = d.neon;
    const mesh = instanced(neonGeometry(), plan.neon, (p) => neon[p.tint], false);
    (mesh.material as THREE.Material).dispose();
    mesh.material = new THREE.MeshBasicMaterial({ vertexColors: true });
    group.add(highOnly(mesh));
  }
  return group;
}
