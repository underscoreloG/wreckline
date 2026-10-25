import * as THREE from 'three';
import type { CarState, PickupKind, RaceSnapshot, SimEvent, TrackGeometry, TrackTheme, Vec2 } from '../shared/contracts';
import { PLAYER_CAR_ID } from '../shared/contracts';
import { createRng } from '../shared/rng';
import type { CarParts } from './carMesh';
import { merge, paint } from './geo';
import { Particles } from './particles';
import { Skidmarks } from './skidmarks';

/** Event and car-state driven effects (design.md section 3). */

const FX_SEED = 0xf1;
const SMOKE_CAP = 2000;
const GLOW_CAP = 1000;
const TRACER_CAP = 128;
const TRACER_LIFE = 0.06;
const TRACER_Y = 1.3;
const TRACER_COLOR = new THREE.Color('#FFE08A').multiplyScalar(2.5);
const SCORCH_CAP = 48;
const MINE_CAP = 64;
const DEBRIS_CAP = 96;
const EXPLOSION_CAP = 16;
const PICKUP_COLORS: Record<PickupKind, string> = { cash: '#2EE6A6', repair: '#E8EAED', mines: '#FF3355', turbo: '#2EA8FF' };
const PICKUP_GLOW = 1.6; // HDR multiplier so icons bloom
const PICKUP_POP = 0.2; // s, scale-out on collect and scale-in on respawn
const SMOKE_COLUMN = 3; // s after an explosion
const DRIFT_MIN_SPEED = 3;
const DAMAGE_SMOKE_BELOW = 0.4;
const FIRE_BELOW = 0.15;
// Headlight beams (WP26): one soft beam per lamp, on dark themes and at high quality only.
const HEADLIGHT_THEMES: ReadonlySet<TrackTheme> = new Set<TrackTheme>(['scrapyard', 'docks', 'snow', 'city']);
const LAMP_OFFSET = 0.3; // x car width from the centre line
const BEAM_LENGTH = 13; // m
const BEAM_HALF_START = 0.3; // m, half width at the lamp
const BEAM_HALF_END = 2.8; // m, half width at the far end
const BEAM_FADE_IN = 1; // m from the lamp to full brightness, so the beam has no hard start line
const BEAM_PEAK = 0.06; // additive linear brightness at the brightest point of one beam
const BEAM_COLOR = [1, 0.93, 0.78] as const; // warm white
const BEAM_SEG_ALONG = 13;
const BEAM_SEG_ACROSS = 8;
// Turbo exhaust flame (WP26): only its core is bright enough to bloom.
const FLAME_LEN_MIN = 0.9; // m, length jitters every frame
const FLAME_LEN_MAX = 1.5; // m
const FLAME_RADIUS = 0.22; // m at the exhaust
const FLAME_CORE = [3, 2.4, 1.5] as const; // HDR, blooms
const FLAME_TIP = [0.7, 0.24, 0.03] as const; // orange, under the bloom threshold
const FLAME_CORE_FRAC = 0.3; // of the length: core to orange, then orange fades out to the tip
// Road-level particles whipping past the player while boosting (WP26), alpha blended (no bloom), fading in and out.
const ROAD_CAP = 96; // alive at once
const ROAD_RATE = 140; // per s: rate * life = 49 alive on average
const ROAD_LIFE = 0.35; // s
const ROAD_SIZE_MIN = 0.08; // m
const ROAD_SIZE_MAX = 0.2; // m
const ROAD_ALPHA = 0.3;
/** World velocity = -car velocity * this: the car outruns them, so they whip backward past it. */
const ROAD_BACK = 0.35;
const ROAD_STRETCH = 0.1; // s of velocity added to the dash length
const ROAD_AHEAD = 5; // m in front of the car centre
const ROAD_BEHIND = 2; // m behind it
const ROAD_SIDE = 3.5; // m beyond each side of the car
const ROAD_Y = 0.12; // m
const ROAD_MIN_SPEED = 3; // m/s
const ROAD_COLORS: Record<TrackTheme, string> = {
  scrapyard: '#9C8468', // dust
  desert: '#E0C08A',
  quarry: '#D9A878',
  city: '#AFC3D6', // spray
  snow: '#F2F6FA',
  docks: '#8E8E86', // grit
};

/** One car's rendered pose for this frame plus its latest state. */
export interface CarFrame {
  x: number;
  z: number;
  heading: number;
  state: CarState;
  parts: CarParts;
}

const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpM = new THREE.Matrix4();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** InstancedMesh rebuilt from scratch every frame (counts here are tiny). */
class Inst {
  readonly mesh: THREE.InstancedMesh;
  private n = 0;

  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, cap: number) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  begin(): void {
    this.n = 0;
  }

  push(x: number, y: number, z: number, q: THREE.Quaternion, sx: number, sy: number, sz: number, r = 1, g = 1, b = 1): void {
    if (this.n >= this.mesh.instanceMatrix.count) return;
    this.mesh.setMatrixAt(this.n, tmpM.compose(tmpP.set(x, y, z), q, tmpS.set(sx, sy, sz)));
    (this.mesh.instanceColor as THREE.InstancedBufferAttribute).setXYZ(this.n, r, g, b);
    this.n++;
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    (this.mesh.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
  }
}

const additive = (opts: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, ...opts });

const yaw = (rotY: number): THREE.Quaternion => tmpQ.setFromAxisAngle(Y_AXIS, rotY);

function pickupGeometry(kind: PickupKind): THREE.BufferGeometry {
  const c = PICKUP_COLORS[kind];
  switch (kind) {
    case 'cash': {
      // Green bill block with a "$" (S strokes + bar) on top.
      const ink = '#0E3B2C';
      const parts = [paint(new THREE.BoxGeometry(1.2, 0.5, 0.75), c)];
      const top = 0.26;
      for (const z of [-0.22, 0, 0.22]) parts.push(paint(new THREE.BoxGeometry(0.42, 0.04, 0.07).translate(0, top, z), ink));
      parts.push(paint(new THREE.BoxGeometry(0.07, 0.04, 0.22).translate(-0.18, top, -0.11), ink));
      parts.push(paint(new THREE.BoxGeometry(0.07, 0.04, 0.22).translate(0.18, top, 0.11), ink));
      parts.push(paint(new THREE.BoxGeometry(0.05, 0.05, 0.62).translate(0, top + 0.005, 0), ink));
      return merge(parts);
    }
    case 'repair':
      return merge([
        paint(new THREE.BoxGeometry(1.3, 0.3, 0.32).rotateY(Math.PI / 4), c),
        paint(new THREE.BoxGeometry(1.3, 0.3, 0.32).rotateY(-Math.PI / 4), c),
        paint(new THREE.CylinderGeometry(0.28, 0.28, 0.31, 8).translate(0.46, 0, 0.46), c),
      ]);
    case 'mines':
      return merge([0, 1, 2].map((i) => paint(new THREE.CylinderGeometry(0.5 - i * 0.08, 0.5 - i * 0.08, 0.14, 10).translate(0, i * 0.2 - 0.2, 0), c)));
    case 'turbo':
      return merge([
        paint(new THREE.CylinderGeometry(0.32, 0.32, 1.1, 10).rotateZ(Math.PI / 2), c),
        paint(new THREE.CylinderGeometry(0.18, 0.22, 0.25, 8).rotateZ(Math.PI / 2).translate(0.66, 0, 0), '#E8F4FF'),
      ]);
  }
}

function starGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? 1 : 0.22;
    const a = (i / 8) * Math.PI * 2;
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  return new THREE.ShapeGeometry(new THREE.Shape(pts)).rotateX(-Math.PI / 2);
}

export const headlightsOn = (theme: TrackTheme): boolean => HEADLIGHT_THEMES.has(theme);

/**
 * One beam on the ground, lamp at the origin, +x forward: a single grid layer whose vertex colors fade smoothly
 * along (soft start, falloff to 0 at the far end) and across (0 at both sides), so it has no inner shape or hard edge.
 */
export function headlightGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  for (let i = 0; i <= BEAM_SEG_ALONG; i++) {
    const u = i / BEAM_SEG_ALONG;
    const x = u * BEAM_LENGTH;
    const hw = BEAM_HALF_START + (BEAM_HALF_END - BEAM_HALF_START) * u;
    const along = smooth(Math.min(1, x / BEAM_FADE_IN)) * (1 - u) ** 2;
    for (let j = 0; j <= BEAM_SEG_ACROSS; j++) {
      const a = (j / BEAM_SEG_ACROSS) * 2 - 1;
      const k = BEAM_PEAK * along * (1 - a * a) ** 2;
      pos.push(x, 0, a * hw);
      col.push(BEAM_COLOR[0] * k, BEAM_COLOR[1] * k, BEAM_COLOR[2] * k);
      if (i < BEAM_SEG_ALONG && j < BEAM_SEG_ACROSS) {
        const v = i * (BEAM_SEG_ACROSS + 1) + j;
        const w = v + BEAM_SEG_ACROSS + 1;
        idx.push(v, v + 1, w, v + 1, w + 1, w);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** Unit-length open cone from the exhaust (x 0) to the tip (x -1), hot core to orange tip in vertex colors. */
function flameGeometry(): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(FLAME_RADIUS, 1, 8, 4, true).rotateZ(Math.PI / 2).translate(-0.5, 0, 0);
  const p = g.getAttribute('position');
  const col: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const t = -p.getX(i);
    const c = FLAME_CORE_FRAC;
    for (let k = 0; k < 3; k++) {
      col.push(t < c ? FLAME_CORE[k] + (FLAME_TIP[k] - FLAME_CORE[k]) * (t / c) : FLAME_TIP[k] * (1 - (t - c) / (1 - c)));
    }
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

interface Timed {
  x: number;
  y: number;
  z: number;
  age: number;
  life: number;
  size: number;
}

export class Fx {
  readonly group = new THREE.Group();
  /** Quality gate, mirrors quality === 'high' (index.ts setQuality). */
  headlightCones = true;
  private readonly headlightTheme: boolean;
  private readonly roadColor: THREE.Color;
  private roadEmit = 0;
  private readonly rng = createRng(FX_SEED);
  private readonly smoke = new Particles(SMOKE_CAP, false);
  private readonly glow = new Particles(GLOW_CAP, true);
  private readonly road = new Particles(ROAD_CAP, false, true);
  private readonly skids = new Skidmarks();
  private readonly tracerPos = new Float32Array(TRACER_CAP * 6);
  private readonly tracerCol = new Float32Array(TRACER_CAP * 6);
  private readonly tracerAge = new Float32Array(TRACER_CAP);
  private tracerN = 0;
  private readonly tracers: THREE.LineSegments;
  private readonly flashes: Timed[] = [];
  private readonly rings: Timed[] = [];
  private readonly columns: { x: number; z: number; until: number }[] = [];
  private readonly scorches: { x: number; z: number; size: number; rot: number }[] = [];
  private readonly debris = new Float32Array(DEBRIS_CAP * 9); // x y z vx vy vz age spin life
  private debrisN = 0;
  private readonly flashInst: Inst;
  private readonly ringInst: Inst;
  private readonly scorchInst: Inst;
  private readonly debrisInst: Inst;
  private readonly muzzleInst: Inst;
  private readonly groundFlashInst: Inst;
  private readonly turboInst: Inst;
  private readonly headInst: Inst;
  private readonly mineInst: Inst;
  private readonly ledInst: Inst;
  private readonly ledGlowInst: Inst;
  private readonly ringPickupInst: Inst;
  private readonly pickupInst: Record<PickupKind, Inst>;
  private readonly pickupChange: Float64Array; // pickup id -> time its active flag last flipped
  private readonly pickupActive: Int8Array; // -1 = not seen yet
  private readonly pickupColor: Record<PickupKind, THREE.Color>;
  private readonly emit: Float32Array; // per car: tire, damage, fire, ember, wreck
  private time = 0;
  constructor(track: TrackGeometry, carCount: number, glowTex: THREE.Texture) {
    this.emit = new Float32Array(carCount * 5);
    this.headlightTheme = headlightsOn(track.def.theme);
    this.roadColor = new THREE.Color(ROAD_COLORS[track.def.theme]);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(this.tracerPos, 3).setUsage(THREE.DynamicDrawUsage));
    tg.setAttribute('color', new THREE.BufferAttribute(this.tracerCol, 3).setUsage(THREE.DynamicDrawUsage));
    tg.setDrawRange(0, 0);
    this.tracers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.tracers.frustumCulled = false;

    this.flashInst = new Inst(new THREE.IcosahedronGeometry(1, 1), additive(), EXPLOSION_CAP);
    this.ringInst = new Inst(new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2), additive({ side: THREE.DoubleSide }), EXPLOSION_CAP);
    this.scorchInst = new Inst(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTex, color: '#000000', transparent: true, opacity: 0.8, depthWrite: false }),
      SCORCH_CAP,
    );
    this.debrisInst = new Inst(new THREE.BoxGeometry(0.35, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: '#2A2522', roughness: 0.8, flatShading: true }), DEBRIS_CAP);
    this.muzzleInst = new Inst(starGeometry(), additive(), carCount);
    this.groundFlashInst = new Inst(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), additive({ map: glowTex }), carCount);
    this.turboInst = new Inst(flameGeometry(), additive({ vertexColors: true, side: THREE.DoubleSide }), carCount);
    // Fog off: fog would tint the zero-brightness beam edges and show the footprint.
    this.headInst = new Inst(headlightGeometry(), additive({ vertexColors: true, side: THREE.DoubleSide, fog: false }), carCount * 2);
    this.mineInst = new Inst(new THREE.CylinderGeometry(0.45, 0.5, 0.14, 10).translate(0, 0.07, 0), new THREE.MeshStandardMaterial({ color: '#1E2024', roughness: 0.5, metalness: 0.4, flatShading: true }), MINE_CAP);
    this.ledInst = new Inst(new THREE.BoxGeometry(0.22, 0.1, 0.22).translate(0, 0.18, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.15, 0.1) }), MINE_CAP);
    // Red ground glow blinking with the LED: a dark disc alone does not read on dark asphalt from 55 m up.
    this.ledGlowInst = new Inst(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), additive({ map: glowTex }), MINE_CAP);
    const nPickups = track.def.pickups.length;
    this.pickupChange = new Float64Array(nPickups).fill(-Infinity);
    this.pickupActive = new Int8Array(nPickups).fill(-1);
    this.pickupColor = {
      cash: new THREE.Color(PICKUP_COLORS.cash),
      repair: new THREE.Color(PICKUP_COLORS.repair),
      mines: new THREE.Color(PICKUP_COLORS.mines),
      turbo: new THREE.Color(PICKUP_COLORS.turbo),
    };
    this.ringPickupInst = new Inst(new THREE.RingGeometry(0.95, 1.3, 24).rotateX(-Math.PI / 2), additive(), Math.max(1, nPickups));
    const basic = (): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(PICKUP_GLOW, PICKUP_GLOW, PICKUP_GLOW) });
    const cap = (k: PickupKind): number => Math.max(1, track.def.pickups.filter((p) => p.kind === k).length);
    this.pickupInst = {
      cash: new Inst(pickupGeometry('cash'), basic(), cap('cash')),
      repair: new Inst(pickupGeometry('repair'), basic(), cap('repair')),
      mines: new Inst(pickupGeometry('mines'), basic(), cap('mines')),
      turbo: new Inst(pickupGeometry('turbo'), basic(), cap('turbo')),
    };
    this.debrisInst.mesh.castShadow = true;
    this.group.add(
      this.skids.mesh,
      this.smoke.mesh,
      this.glow.mesh,
      this.road.mesh,
      this.tracers,
      ...[this.flashInst, this.ringInst, this.scorchInst, this.debrisInst, this.muzzleInst, this.groundFlashInst, this.turboInst, this.headInst, this.mineInst, this.ledInst, this.ledGlowInst, this.ringPickupInst, ...Object.values(this.pickupInst)].map((i) => i.mesh),
    );
  }

  // ------------------------------------------------------------ events

  onEvent(e: SimEvent, cars: readonly CarFrame[]): void {
    switch (e.type) {
      case 'gunShot':
        this.tracer(e.from, e.to);
        if (e.hitCar !== null || e.hitWall) this.sparks(e.to.x, e.to.y, 12);
        break;
      case 'impact':
        this.sparks(e.pos.x, e.pos.y, Math.round(Math.min(30, Math.max(12, 12 + (e.speed - 4) * 1.5))));
        break;
      case 'mineExploded':
        this.explosion(e.pos.x, e.pos.y, false);
        break;
      case 'carWrecked':
        this.explosion(e.pos.x, e.pos.y, true);
        break;
      case 'pickupCollected':
        this.pickupBurst(e.pos, e.kind);
        break;
      case 'gunOverheat': {
        const c = cars[e.car];
        if (c) this.steam(c);
        break;
      }
      // Drawn from car state (flags, hp, wrecked), by the gantry, or not visual at all.
      case 'countdown':
      case 'raceStart':
      case 'lapCompleted':
      case 'finalLap':
      case 'carFinished':
      case 'raceFinished':
      case 'carDamaged':
      case 'mineDropped':
      case 'turboStart':
      case 'turboEnd':
      case 'pickupRespawned': // scale-in starts when the snapshot flag flips
        break;
    }
  }

  private tracer(from: Vec2, to: Vec2): void {
    if (this.tracerN >= TRACER_CAP) return;
    const i = this.tracerN++;
    this.tracerPos.set([from.x, TRACER_Y, from.y, to.x, TRACER_Y, to.y], i * 6);
    this.tracerAge[i] = 0;
  }

  private sparks(x: number, z: number, count: number): void {
    const rng = this.rng;
    for (let i = 0; i < count; i++) {
      const a = rng.next() * Math.PI * 2;
      const v = rng.range(6, 14);
      this.glow.spawn(x, 0.6, z, Math.cos(a) * v, rng.range(0, 3), Math.sin(a) * v, 0.25, 0.12, 0.06, 3, 2.1, 0.8, 1, 0, 6, 9, 0.04);
    }
  }

  private pickupBurst(pos: Vec2, kind: PickupKind): void {
    const c = new THREE.Color(PICKUP_COLORS[kind]).multiplyScalar(2);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const v = this.rng.range(4, 7);
      this.glow.spawn(pos.x, 1, pos.y, Math.cos(a) * v, this.rng.range(2, 4), Math.sin(a) * v, 0.5, 0.45, 0.1, c.r, c.g, c.b, 1, 0, 3, 6, 0.03);
    }
  }

  private steam(c: CarFrame): void {
    const m = c.parts.muzzle;
    this.local(c, m.x - 0.6, m.z);
    for (let i = 0; i < 8; i++) {
      const r = this.rng;
      this.smoke.spawn(this.lx, m.y, this.lz, r.range(-1, 1), r.range(1.5, 3), r.range(-1, 1), 0.7, 0.4, 1.4, 0.8, 0.8, 0.82, 0.4, 0, 1.5, 0, 0);
    }
  }

  private explosion(x: number, z: number, big: boolean): void {
    const k = big ? 1 : 0.7;
    const rng = this.rng;
    this.flashes.push({ x, y: 1, z, age: 0, life: 0.12, size: 4.5 * k });
    this.rings.push({ x, y: 0.15, z, age: 0, life: 0.45, size: 10 * k });
    this.columns.push({ x, z, until: this.time + SMOKE_COLUMN });
    if (this.scorches.length >= SCORCH_CAP) this.scorches.shift();
    this.scorches.push({ x, z, size: 6 * k, rot: rng.next() * Math.PI * 2 });
    for (let i = 0; i < 40 * k; i++) {
      const a = rng.next() * Math.PI * 2;
      const v = rng.range(2, 8);
      this.glow.spawn(x, 1, z, Math.cos(a) * v, rng.range(2, 6), Math.sin(a) * v, rng.range(0.4, 0.8), rng.range(1.5, 2.5) * k, 4 * k, 3, rng.range(0.6, 1.2), 0.08, 1, 0, 3, -1, 0);
    }
    this.sparks(x, z, 20);
    for (let i = 0; i < 10 && this.debrisN < DEBRIS_CAP; i++) {
      const a = rng.next() * Math.PI * 2;
      const v = rng.range(4, 10);
      this.debris.set([x, 1, z, Math.cos(a) * v, rng.range(6, 12), Math.sin(a) * v, 0, rng.range(-12, 12), 1.6], this.debrisN++ * 9);
    }
  }

  // ------------------------------------------------------------ per frame

  private lx = 0;
  private lz = 0;

  /** Car frame point (+x forward, +z right) to world x/z, written to this.lx/this.lz (no tuple allocation per call). */
  private local(c: CarFrame, x: number, z: number): void {
    const cs = Math.cos(c.heading);
    const sn = Math.sin(c.heading);
    this.lx = c.x + x * cs - z * sn;
    this.lz = c.z + x * sn + z * cs;
  }

  update(dt: number, cars: readonly CarFrame[], snap: RaceSnapshot): void {
    this.time += dt;
    const t = this.time;
    const rng = this.rng;

    this.muzzleInst.begin();
    this.groundFlashInst.begin();
    this.turboInst.begin();
    this.headInst.begin();
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      const s = c.state;
      const e = i * 5;
      const rotY = -c.heading;
      const speed = Math.abs(s.speed);
      const hpFrac = s.maxHp > 0 ? s.hp / s.maxHp : 1;
      const drifting = !s.wrecked && s.drifting && speed > DRIFT_MIN_SPEED;
      if (drifting) this.emit[e] += dt * 30;
      for (let k = 0; k < 2; k++) {
        const w = c.parts.rearWheels[k];
        this.local(c, w.x, w.z);
        this.skids.track(i * 2 + k, this.lx, this.lz, drifting);
      }
      while (this.emit[e] >= 1) {
        this.emit[e]--;
        // Alternate puffs between the two rear wheels.
        const w = c.parts.rearWheels[this.emit[e] > 0.5 ? 1 : 0];
        this.local(c, w.x, w.z);
        this.smoke.spawn(this.lx, 0.3, this.lz, rng.range(-0.8, 0.8), rng.range(0.3, 0.9), rng.range(-0.8, 0.8), 0.8, 0.8, 2.6, 0.5, 0.5, 0.52, 0.4, 0, 1, 0, 0);
      }
      if (!drifting) this.emit[e] = 0;

      this.local(c, c.parts.hood.x, c.parts.hood.z);
      const hx = this.lx;
      const hz = this.lz;
      if (!s.wrecked && hpFrac < DAMAGE_SMOKE_BELOW) {
        this.emit[e + 1] += dt * (6 + 30 * (1 - hpFrac / DAMAGE_SMOKE_BELOW));
        while (this.emit[e + 1] >= 1) {
          this.emit[e + 1]--;
          this.smoke.spawn(hx, c.parts.hood.y, hz, rng.range(-0.5, 0.5), rng.range(2, 3), rng.range(-0.5, 0.5), 1.4, 0.7, 3, 0.07, 0.07, 0.075, 0.6, 0, 0.8, 0, 0);
        }
      }
      if (!s.wrecked && hpFrac < FIRE_BELOW) {
        this.emit[e + 2] += dt * 35;
        while (this.emit[e + 2] >= 1) {
          this.emit[e + 2]--;
          this.glow.spawn(hx + rng.range(-0.3, 0.3), c.parts.hood.y, hz + rng.range(-0.3, 0.3), 0, rng.range(2, 4), 0, 0.35, 0.7, 0.2, 2.6, rng.range(0.8, 1.5), 0.2, 1, 0, 1, -2, 0);
        }
        this.emit[e + 3] += dt * 8;
        while (this.emit[e + 3] >= 1) {
          this.emit[e + 3]--;
          this.glow.spawn(hx, c.parts.hood.y, hz, rng.range(-2, 2), rng.range(3, 6), rng.range(-2, 2), 0.8, 0.1, 0.05, 3, 1.6, 0.4, 1, 0, 1, 4, 0.05);
        }
      }
      if (s.wrecked && snap.phase !== 'finished') {
        this.emit[e + 4] += dt * 16;
        while (this.emit[e + 4] >= 1) {
          this.emit[e + 4]--;
          this.smoke.spawn(c.x + rng.range(-0.5, 0.5), 1, c.z + rng.range(-0.5, 0.5), rng.range(-0.4, 0.4), rng.range(3, 4.5), rng.range(-0.4, 0.4), 3, 1.4, 6, 0.09, 0.088, 0.085, 0.55, 0, 0.3, 0, 0);
        }
      }

      if (s.firing && !s.wrecked && rng.chance(0.65)) {
        const m = c.parts.muzzle;
        this.local(c, m.x, m.z);
        const k = rng.range(0.35, 0.6);
        this.muzzleInst.push(this.lx, m.y, this.lz, yaw(rng.next() * Math.PI), k, k, k, 3, 2.3, 1.1);
        this.groundFlashInst.push(this.lx, 0.06, this.lz, yaw(0), 4, 1, 4, 0.35, 0.25, 0.1);
      }
      if (s.turboActive && !s.wrecked) {
        const ex = c.parts.exhaust;
        this.local(c, ex.x, ex.z);
        const tx = this.lx;
        const tz = this.lz;
        const w = rng.range(0.85, 1.1);
        const b = rng.range(0.8, 1.15);
        this.turboInst.push(tx, ex.y, tz, yaw(rotY), rng.range(FLAME_LEN_MIN, FLAME_LEN_MAX), w, w, b, b, b);
      }
      if (i === PLAYER_CAR_ID && s.turboActive && !s.wrecked && speed > ROAD_MIN_SPEED) {
        this.roadEmit += dt * ROAD_RATE;
        const side = Math.abs(c.parts.rearWheels[1].z) + ROAD_SIDE; // rear wheels sit at half the car width
        const rc = this.roadColor;
        while (this.roadEmit >= 1) {
          this.roadEmit--;
          this.local(c, rng.range(-ROAD_BEHIND, ROAD_AHEAD), rng.range(-side, side));
          const sz = rng.range(ROAD_SIZE_MIN, ROAD_SIZE_MAX);
          this.road.spawn(this.lx, ROAD_Y, this.lz, -s.vel.x * ROAD_BACK, 0, -s.vel.y * ROAD_BACK, ROAD_LIFE, sz, sz, rc.r, rc.g, rc.b, ROAD_ALPHA, 0, 0, 0, ROAD_STRETCH);
        }
      } else if (i === PLAYER_CAR_ID) {
        this.roadEmit = 0;
      }
      if (this.headlightCones && this.headlightTheme && !s.wrecked) {
        const lamp = Math.abs(c.parts.rearWheels[1].z) * 2 * LAMP_OFFSET; // rear wheels sit at half the car width
        for (let k = -1; k <= 1; k += 2) {
          this.local(c, c.parts.nose.x, k * lamp);
          this.headInst.push(this.lx, 0.06, this.lz, yaw(rotY), 1, 1, 1);
        }
      }
    }
    this.muzzleInst.end();
    this.groundFlashInst.end();
    this.turboInst.end();
    this.headInst.end();

    // Smoke columns after explosions.
    for (let i = this.columns.length - 1; i >= 0; i--) {
      const col = this.columns[i];
      if (t > col.until) {
        this.columns.splice(i, 1);
        continue;
      }
      // 25 puffs per second, the fractional part as a probability (frame rate independent on average).
      const rate = dt * 25;
      const n = Math.floor(rate) + (rng.chance(rate - Math.floor(rate)) ? 1 : 0);
      for (let k = 0; k < n; k++) {
        this.smoke.spawn(col.x + rng.range(-1, 1), 1, col.z + rng.range(-1, 1), rng.range(-0.6, 0.6), rng.range(3, 5), rng.range(-0.6, 0.6), 2.5, 2, 7, 0.08, 0.075, 0.07, 0.65, 0, 0.4, 0, 0);
      }
    }

    this.updateTimed(dt);
    this.updateTracers(dt);
    this.updateDebris(dt);
    this.updatePickups(snap);
    this.updateMines(snap);
    this.smoke.update(dt);
    this.glow.update(dt);
    this.road.update(dt);
  }

  private updateTimed(dt: number): void {
    this.flashInst.begin();
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.age += dt;
      if (f.age >= f.life) {
        this.flashes.splice(i, 1);
        continue;
      }
      const k = f.age / f.life;
      const s = f.size * (0.4 + 0.6 * k);
      const b = 4 * (1 - k);
      this.flashInst.push(f.x, f.y, f.z, yaw(0), s, s * 0.7, s, b, b * 0.55, b * 0.2);
    }
    this.flashInst.end();
    this.ringInst.begin();
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      if (r.age >= r.life) {
        this.rings.splice(i, 1);
        continue;
      }
      const k = r.age / r.life;
      const s = 0.5 + r.size * Math.sqrt(k);
      const b = 2 * (1 - k);
      this.ringInst.push(r.x, r.y, r.z, yaw(0), s, 1, s, b, b * 0.6, b * 0.25);
    }
    this.ringInst.end();
    this.scorchInst.begin();
    for (const s of this.scorches) this.scorchInst.push(s.x, 0.038, s.z, yaw(s.rot), s.size, 1, s.size);
    this.scorchInst.end();
  }

  private updateTracers(dt: number): void {
    let i = 0;
    while (i < this.tracerN) {
      this.tracerAge[i] += dt;
      if (this.tracerAge[i] >= TRACER_LIFE) {
        const last = --this.tracerN;
        if (last !== i) {
          this.tracerPos.copyWithin(i * 6, last * 6, last * 6 + 6);
          this.tracerAge[i] = this.tracerAge[last];
        }
        continue;
      }
      const k = 1 - this.tracerAge[i] / TRACER_LIFE;
      for (let v = 0; v < 6; v += 3) {
        this.tracerCol[i * 6 + v] = TRACER_COLOR.r * k;
        this.tracerCol[i * 6 + v + 1] = TRACER_COLOR.g * k;
        this.tracerCol[i * 6 + v + 2] = TRACER_COLOR.b * k;
      }
      i++;
    }
    const g = this.tracers.geometry;
    g.setDrawRange(0, this.tracerN * 2);
    g.getAttribute('position').needsUpdate = true;
    g.getAttribute('color').needsUpdate = true;
    this.tracers.visible = this.tracerN > 0;
  }

  private updateDebris(dt: number): void {
    const d = this.debris;
    let i = 0;
    this.debrisInst.begin();
    while (i < this.debrisN) {
      const o = i * 9;
      d[o + 6] += dt;
      if (d[o + 6] >= d[o + 8]) {
        const last = --this.debrisN * 9;
        if (last !== o) d.copyWithin(o, last, last + 9);
        continue;
      }
      if (d[o + 1] > 0.1 || d[o + 4] > 0) {
        d[o + 4] -= 22 * dt;
        d[o] += d[o + 3] * dt;
        d[o + 1] = Math.max(0.1, d[o + 1] + d[o + 4] * dt);
        d[o + 2] += d[o + 5] * dt;
        if (d[o + 1] <= 0.1) d[o + 3] = d[o + 4] = d[o + 5] = 0; // lands and stays
      }
      tmpE.set(d[o + 6] * d[o + 7], d[o + 6] * d[o + 7] * 0.7, 0);
      this.debrisInst.push(d[o], d[o + 1], d[o + 2], tmpQ.setFromEuler(tmpE), 1, 1, 1);
      i++;
    }
    this.debrisInst.end();
  }

  private updatePickups(snap: RaceSnapshot): void {
    const t = this.time;
    for (const inst of Object.values(this.pickupInst)) inst.begin();
    this.ringPickupInst.begin();
    for (const pk of snap.pickups) {
      const active = pk.active ? 1 : 0;
      if (this.pickupActive[pk.id] !== -1 && this.pickupActive[pk.id] !== active) this.pickupChange[pk.id] = t;
      this.pickupActive[pk.id] = active;
      // Collected: pop then shrink to nothing over 0.2 s; respawned: grow back in 0.2 s.
      const k = Math.min(1, (t - this.pickupChange[pk.id]) / PICKUP_POP);
      const scale = pk.active ? k : k < 1 ? (1 - k) * (1 + 0.8 * k) : 0;
      if (scale <= 0) continue;
      const y = 1.1 + 0.15 * Math.sin(t * Math.PI * 2 + pk.id);
      this.pickupInst[pk.kind].push(pk.pos.x, y, pk.pos.y, yaw(t * 2 + pk.id), scale, scale, scale);
      const c = this.pickupColor[pk.kind];
      this.ringPickupInst.push(pk.pos.x, 0.07, pk.pos.y, yaw(0), scale, 1, scale, c.r, c.g, c.b);
    }
    for (const inst of Object.values(this.pickupInst)) inst.end();
    this.ringPickupInst.end();
  }

  private updateMines(snap: RaceSnapshot): void {
    const t = this.time;
    this.mineInst.begin();
    this.ledInst.begin();
    this.ledGlowInst.begin();
    for (const m of snap.mines) {
      this.mineInst.push(m.pos.x, 0, m.pos.y, yaw(m.id), 1, 1, 1);
      const hz = m.armed ? 5 : 2;
      if ((t * hz + m.id * 0.37) % 1 < 0.5) {
        this.ledInst.push(m.pos.x, 0, m.pos.y, yaw(0), 1, 1, 1);
        this.ledGlowInst.push(m.pos.x, 0.05, m.pos.y, yaw(0), 2.4, 1, 2.4, 1.2, 0.05, 0.03);
      }
    }
    this.mineInst.end();
    this.ledInst.end();
    this.ledGlowInst.end();
  }
}
