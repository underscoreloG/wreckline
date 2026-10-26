import * as THREE from 'three';
import type { CarMeshSpec, CarMeshStyle } from '../shared/contracts';
import { clamp } from '../shared/math';
import { getCarModel } from './carModel';
import { bar, boxNoBottom, merge, paint } from './geo';

/**
 * Procedural cars (WP03), modeled facing +x with the origin at the ground center.
 * Draw calls per car: body (with extras and bumper spikes), glass, lights, gun, 4 wheels.
 * Imported models (WP14) replace them once preloaded: model, bumper spikes, plus the driver colour marker (WP30, `CarMark`).
 */

const BEVEL = 0.08;
const CABIN_HEIGHT = 0.45;
const TRUCK_CAB_HEIGHT = 0.7;
const WHEEL_WIDTH = 0.3;
const WHEEL_SEGMENTS = 10;
const STEER_MAX = 0.45;
const GLASS = '#14181F';
const METAL = '#2E3136';
const STEEL = '#A8ADB3';
const GUN = '#24272C';
const TIRE = '#1A1A1C';
const HEAD_LIGHT = '#FFFFFF';
const HEAD_INTENSITY = 2;
const TAIL_LIGHT = '#FF2A2A';
const TAIL_INTENSITY = 1;
const TAIL_BRAKING = 3;
const STRIPE_SHADE = 0.6;
const WRECK_TINT = 0.2;
const DAMAGE_TINT = 0.45; // brightness lost at 0 hp before the wreck
const SPIKE_RADIUS = 0.07;
const SPIKE_LENGTH = 0.3;
const SPIKE_HEIGHT = 0.25; // fraction of body height above the body bottom
const SPIKE_SPREAD = 0.8; // fraction of width the row covers
const MUSCLE_BUMPER = 0.12; // the muscle push bar sticks out this far past the nose
/**
 * Driver colour marker on imported cars (WP30, design.md "Car art"), the body paint stays the model's own:
 * rim = soft fresnel edge glow on the body material (no extra draw call), underglow = additive ground glow under
 * the car (one quad), none = no marker. `?carMark=<mode>` picks one so the modes can be compared live.
 */
export type CarMark = 'rim' | 'underglow' | 'none';
const CAR_MARKS: readonly CarMark[] = ['rim', 'underglow', 'none'];
export const DEFAULT_CAR_MARK: CarMark = 'rim';
/** Rim: emissive at grazing angles = driver colour x MARK_RIM x (1 - n.v)^RIM_POWER. */
export const MARK_RIM = 0.6;
const RIM_POWER = 2.5;
/** Underglow: additive radial glow = driver colour x MARK_UNDERGLOW, quad = car footprint x these factors. */
export const MARK_UNDERGLOW = 0.55;
const UNDERGLOW_LENGTH = 1.5;
const UNDERGLOW_WIDTH = 2.3;
const UNDERGLOW_CORE = 0.3; // radius fraction kept at full strength
const UNDERGLOW_Y = 0.04; // m above the ground, under the car

/** Side profiles, x in -0.5..0.5 of length (front = +x), y in 0..1 of height. Listed CCW: bottom edge, then the top from nose to tail. */
const PROFILES: Record<CarMeshStyle, readonly (readonly [number, number])[]> = {
  compact: [[-0.5, 0], [0.5, 0], [0.5, 0.55], [0.4, 0.9], [0.25, 1], [-0.3, 1], [-0.45, 0.9], [-0.5, 0.6]],
  muscle: [[-0.5, 0], [0.5, 0], [0.5, 0.7], [0.42, 0.88], [-0.45, 1], [-0.5, 0.85]],
  wedge: [[-0.5, 0], [0.5, 0], [0.5, 0.25], [-0.3, 1], [-0.5, 1]],
  boss: [[-0.5, 0], [0.5, 0], [0.5, 0.8], [0.4, 1], [-0.5, 1]],
  buggy: [[-0.5, 0], [0.5, 0], [0.45, 0.65], [-0.45, 0.65]],
  wagon: [[-0.5, 0], [0.5, 0], [0.5, 0.75], [0.4, 1], [-0.5, 1]],
  truck: [[-0.5, 0], [0.5, 0], [0.5, 0.8], [0.42, 1], [-0.5, 1]],
};

const v3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** Triangles from quads with outward winding (checked against `center`), flat normals. */
function hull(quads: THREE.Vector3[][], center: THREE.Vector3): THREE.BufferGeometry {
  const pos: number[] = [];
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const mid = new THREE.Vector3();
  for (const q of quads) {
    e1.subVectors(q[1], q[0]);
    e2.subVectors(q[2], q[0]);
    mid.set(0, 0, 0);
    for (const p of q) mid.add(p);
    mid.divideScalar(q.length).sub(center);
    const quad = e1.cross(e2).dot(mid) < 0 ? [...q].reverse() : q;
    for (let i = 1; i + 1 < quad.length; i++) for (const p of [quad[0], quad[i], quad[i + 1]]) pos.push(p.x, p.y, p.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Box from x0..x1 (bottom) narrowing to tx0..tx1 / half width tw at the top, no bottom face: 10 triangles. */
function taperedBox(x0: number, x1: number, tx0: number, tx1: number, y0: number, y1: number, w: number, tw: number): THREE.BufferGeometry {
  const b = [v3(x0, y0, -w), v3(x1, y0, -w), v3(x1, y0, w), v3(x0, y0, w)];
  const t = [v3(tx0, y1, -tw), v3(tx1, y1, -tw), v3(tx1, y1, tw), v3(tx0, y1, tw)];
  const quads = [t, [b[0], b[1], t[1], t[0]], [b[1], b[2], t[2], t[1]], [b[2], b[3], t[3], t[2]], [b[3], b[0], t[0], t[3]]];
  return hull(quads, v3((x0 + x1) / 2, (y0 + y1) / 2, 0));
}

function at(g: THREE.BufferGeometry, x: number, y: number, z: number, rotZ = 0): THREE.BufferGeometry {
  if (rotZ) g.rotateZ(rotZ);
  g.translate(x, y, z);
  return g;
}

const shade = (color: string, k: number): THREE.Color => new THREE.Color(color).multiplyScalar(k);

/**
 * Bumper spikes (CCR-5): 2 open 4-sided cones per level along the front bumper, dark metal, painted and
 * non-indexed like every body part (position, normal, color), in the car frame (+x forward, origin at the
 * ground center). null for level 0 and for styles that already carry spikes (boss).
 */
export function buildSpikesGeometry(spec: CarMeshSpec): THREE.BufferGeometry | null {
  const n = 2 * clamp(Math.round(spec.spikes), 0, 3);
  if (n === 0 || spec.style === 'boss') return null;
  const x = spec.length / 2 + (spec.style === 'muscle' ? MUSCLE_BUMPER : 0) + SPIKE_LENGTH / 2 - 0.04;
  const y = spec.wheelRadius * 0.9 + SPIKE_HEIGHT * spec.height;
  const row = SPIKE_SPREAD * spec.width;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    // Apex along +y, turned to point forward (+x).
    const cone = new THREE.ConeGeometry(SPIKE_RADIUS, SPIKE_LENGTH, 4, 1, true);
    parts.push(paint(at(cone, x, y, -row / 2 + ((i + 0.5) * row) / n, -Math.PI / 2), METAL));
  }
  return merge(parts);
}

export interface CarParts {
  group: THREE.Group;
  bodyMaterial: THREE.MeshStandardMaterial;
  /** Driver colour marker colours (live, base): the rig scales them by the damage tint, 0 once wrecked. */
  glows: { color: THREE.Color; base: THREE.Color }[];
  lights: THREE.BufferAttribute; // color attribute of the lights mesh
  tailStart: number; // first tail-light vertex in `lights`
  wheels: { pivot: THREE.Group; mesh: THREE.Mesh; front: boolean; side: number }[];
  /** Local anchor points (car frame, +x forward) for effects. */
  muzzle: THREE.Vector3;
  nose: THREE.Vector3;
  exhaust: THREE.Vector3;
  hood: THREE.Vector3;
  rearWheels: [THREE.Vector3, THREE.Vector3];
}

const flat = { flatShading: true, vertexColors: true } as const;

/** `?carMark=<mode>` when valid, else DEFAULT_CAR_MARK. */
export function carMarkFromUrl(): CarMark {
  const v = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('carMark');
  return CAR_MARKS.find((m) => m === v) ?? DEFAULT_CAR_MARK;
}

/** Rim: adds the fresnel term to the emissive; every rim car shares one program, the colour is a per-material uniform. */
function addRim(material: THREE.MeshStandardMaterial, rim: THREE.Color): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: rim };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\ntotalEmissiveRadiance += rimColor * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), ${RIM_POWER.toFixed(2)});`,
      );
  };
  material.customProgramCacheKey = () => 'carRim';
}

let underglowMap: THREE.DataTexture | null = null;

/** White radial falloff in the alpha channel (full under the car, fading out past it), built in code (no canvas), shared. */
function underglowTexture(): THREE.DataTexture {
  if (underglowMap) return underglowMap;
  const n = 64;
  const data = new Uint8Array(n * n * 4).fill(255);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
      data[(y * n + x) * 4 + 3] = Math.round(255 * (1 - THREE.MathUtils.smoothstep(r, UNDERGLOW_CORE, 1)));
    }
  }
  underglowMap = new THREE.DataTexture(data, n, n);
  underglowMap.magFilter = underglowMap.minFilter = THREE.LinearFilter;
  underglowMap.needsUpdate = true;
  return underglowMap;
}

/** Imported model (shared geometry, own body material), spikes on its bumper, the driver colour marker. */
function importedParts(spec: CarMeshSpec, color: string, model: THREE.Group, mark: CarMark): CarParts {
  let bodyMaterial: THREE.MeshStandardMaterial | null = null;
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    // The import keeps one material per car; a clone shares its texture.
    bodyMaterial ??= (m.material as THREE.MeshStandardMaterial).clone();
    m.material = bodyMaterial;
  });
  bodyMaterial ??= new THREE.MeshStandardMaterial();
  const bounds = new THREE.Box3().setFromObject(model);
  const glows: CarParts['glows'] = [];
  if (mark === 'rim') {
    const base = new THREE.Color(color).multiplyScalar(MARK_RIM);
    const rim = base.clone();
    addRim(bodyMaterial, rim);
    glows.push({ color: rim, base });
  } else if (mark === 'underglow') {
    const base = new THREE.Color(color).multiplyScalar(MARK_UNDERGLOW);
    const material = new THREE.MeshBasicMaterial({ map: underglowTexture(), color: base, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(size.x * UNDERGLOW_LENGTH, size.z * UNDERGLOW_WIDTH).rotateX(-Math.PI / 2), material);
    quad.name = 'underglow';
    quad.position.set(center.x, UNDERGLOW_Y, center.z);
    model.add(quad);
    glows.push({ color: material.color, base: base.clone() });
  }
  const spikes = buildSpikesGeometry(spec);
  if (spikes) {
    // Onto the model's own front end instead of the procedural bumper.
    spikes.computeBoundingBox();
    spikes.translate(bounds.max.x - 0.04 - spikes.boundingBox!.min.x, 0, 0);
    const m = new THREE.Mesh(spikes, new THREE.MeshStandardMaterial({ ...flat, roughness: 0.55, metalness: 0.25 }));
    m.name = 'spikes';
    m.castShadow = true;
    model.add(m);
  }
  const L = bounds.max.x - bounds.min.x;
  const W = bounds.max.z - bounds.min.z;
  const hoodY = spec.wheelRadius * 0.9 + spec.height;
  return {
    group: model,
    bodyMaterial,
    glows,
    // No light meshes: the model's lights are painted in its texture.
    lights: new THREE.BufferAttribute(new Float32Array(0), 3),
    tailStart: 0,
    wheels: [],
    muzzle: v3(bounds.max.x + 0.2, hoodY, 0),
    nose: v3(bounds.max.x, 0, 0),
    exhaust: v3(bounds.min.x - 0.15, spec.wheelRadius * 0.9 + 0.25 * spec.height, 0),
    hood: v3(0.3 * L, hoodY + 0.1, 0),
    rearWheels: [v3(-0.36 * L, 0, -0.5 * W), v3(-0.36 * L, 0, 0.5 * W)],
  };
}

export function buildCarParts(spec: CarMeshSpec, color: string, mark: CarMark = carMarkFromUrl()): CarParts {
  const model = getCarModel(spec);
  if (model) return importedParts(spec, color, model, mark);
  const L = spec.length;
  const W = spec.width;
  const H = spec.height;
  const r = spec.wheelRadius;
  const base = r * 0.9;
  const prof = PROFILES[spec.style];
  const style = spec.style;

  // Body: beveled extrude of the side profile, so every edge (the top ones are what the camera sees) is chamfered.
  const shape = new THREE.Shape(prof.map(([x, y]) => new THREE.Vector2(x * (L - 2 * BEVEL), BEVEL + y * (H - 2 * BEVEL))));
  const body = new THREE.ExtrudeGeometry(shape, {
    depth: W - 2 * BEVEL,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 1,
    steps: 1,
    curveSegments: 1,
  });
  body.translate(0, base, -(W - 2 * BEVEL) / 2);

  // Top surface height along x, from the profile's top chain (nose to tail).
  const chain = prof.slice(2).map(([x, y]) => [x * L, base + 2 * BEVEL + y * (H - 2 * BEVEL)] as const);
  const topY = (x: number): number => {
    if (x >= chain[0][0]) return chain[0][1];
    for (let i = 1; i < chain.length; i++) {
      const [xa, ya] = chain[i - 1];
      const [xb, yb] = chain[i];
      if (x >= xb) return xa === xb ? Math.max(ya, yb) : yb + ((ya - yb) * (x - xb)) / (xa - xb);
    }
    return chain[chain.length - 1][1];
  };

  const bodyParts: THREE.BufferGeometry[] = [paint(body, color)];
  const glassParts: THREE.BufferGeometry[] = [];
  const gunParts: THREE.BufferGeometry[] = [];
  const headParts: THREE.BufferGeometry[] = [];
  const tailParts: THREE.BufferGeometry[] = [];

  // Cabin footprint: x0 = rear, x1 = front.
  const cx = spec.cabinOffset * L;
  let x0 = cx - (spec.cabinLength * L) / 2;
  const x1 = cx + (spec.cabinLength * L) / 2;
  if (style === 'wagon') x0 = -L / 2 + 0.15; // long flat roof to the rear
  const wb = (0.75 * W) / 2;
  const cabY0 = Math.min(topY(x0), topY(x1)) - 0.05;
  const cabH = style === 'truck' ? TRUCK_CAB_HEIGHT : CABIN_HEIGHT;
  let roofY: number;
  let roof: { x0: number; x1: number; w: number };

  if (style === 'buggy') {
    // Open roll cage: 4 uprights + 2 top rails, a 4-lamp light bar on the front rail.
    roofY = Math.max(topY(x0), topY(x1)) + 0.75;
    const t = 0.07;
    const corners = [v3(x0, 0, -wb), v3(x1, 0, -wb), v3(x1, 0, wb), v3(x0, 0, wb)];
    for (const c of corners) bodyParts.push(paint(bar(v3(c.x, topY(c.x) - 0.05, c.z), v3(c.x, roofY, c.z), t), METAL));
    bodyParts.push(paint(bar(v3(x0, roofY, -wb), v3(x1, roofY, -wb), t), METAL));
    bodyParts.push(paint(bar(v3(x0, roofY, wb), v3(x1, roofY, wb), t), METAL));
    bodyParts.push(paint(bar(v3(x1, roofY + 0.1, -wb), v3(x1, roofY + 0.1, wb), 0.08), METAL));
    for (let i = 0; i < 4; i++) headParts.push(at(boxNoBottom(0.1, 0.12, 0.18), x1 + 0.06, roofY + 0.1, -wb + ((i + 0.5) * 2 * wb) / 4));
    roof = { x0, x1, w: wb };
  } else {
    roofY = cabY0 + 0.05 + cabH;
    const len = x1 - x0;
    const tx1 = x1 - len * (style === 'truck' ? 0.1 : 0.25);
    const tx0 = x0 + (style === 'wagon' ? 0.05 : len * 0.12);
    const tw = wb * 0.85;
    glassParts.push(paint(taperedBox(x0, x1, tx0, tx1, cabY0, roofY, wb, tw), GLASS));
    roof = { x0: tx0, x1: tx1, w: tw };
  }

  // Hood stripe, darker livery, following the top surface from the cabin to the nose.
  const sx0 = Math.min(x1, L / 2 - 0.2);
  const sx1 = L / 2 - 0.1;
  const xs = [sx0, ...chain.map(([x]) => x).filter((x) => x > sx0 && x < sx1), sx1].sort((a, b) => a - b);
  const sw = W * 0.14;
  const stripeQuads: THREE.Vector3[][] = [];
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1];
    const b = xs[i];
    stripeQuads.push([v3(a, topY(a) + 0.02, -sw), v3(b, topY(b) + 0.02, -sw), v3(b, topY(b) + 0.02, sw), v3(a, topY(a) + 0.02, sw)]);
  }
  // Only the top side matters; the hull helper needs a center below the strip to wind it upward.
  bodyParts.push(paint(hull(stripeQuads, v3((sx0 + sx1) / 2, -10, 0)), shade(color, STRIPE_SHADE)));

  // Style extras, merged with the body.
  if (style === 'muscle') {
    const nx = L / 2 + 0.12;
    bodyParts.push(paint(bar(v3(nx, base + 0.35 * H, -0.4 * W), v3(nx, base + 0.35 * H, 0.4 * W), 0.1), METAL));
    for (const z of [-0.3 * W, 0.3 * W]) bodyParts.push(paint(bar(v3(nx - 0.08, base + 0.02, z), v3(nx, base + 0.65 * H, z), 0.1), METAL));
  } else if (style === 'boss') {
    bodyParts.push(paint(at(boxNoBottom(0.14, H * 0.95, W * 1.04), L / 2 + 0.1, base + H * 0.45, 0, -0.25), METAL));
    for (const fx of [-0.35, -0.12, 0.12, 0.35]) {
      for (const side of [-1, 1]) {
        const spike = new THREE.ConeGeometry(0.09, 0.32, 4, 1, true);
        spike.rotateX(side * (Math.PI / 2));
        bodyParts.push(paint(at(spike, fx * L, base + H * 0.55, side * (W / 2 + 0.14)), STEEL));
      }
    }
  } else if (style === 'wagon') {
    const y = roofY + 0.12;
    const rz = roof.w * 0.85;
    const ra = roof.x0 + 0.1;
    const rb = roof.x1 - 0.1;
    bodyParts.push(paint(bar(v3(ra, y, -rz), v3(rb, y, -rz), 0.06), METAL));
    bodyParts.push(paint(bar(v3(ra, y, rz), v3(rb, y, rz), 0.06), METAL));
    for (const x of [ra, (ra + rb) / 2, rb]) bodyParts.push(paint(bar(v3(x, y, -rz), v3(x, y, rz), 0.06), METAL));
  } else if (style === 'truck') {
    const top = topY(-L / 2 + 0.2);
    const bx0 = -L / 2 + 0.1;
    const bx1 = x0 - 0.05;
    const bl = bx1 - bx0;
    for (const side of [-1, 1]) bodyParts.push(paint(at(boxNoBottom(bl, 0.4, 0.08), (bx0 + bx1) / 2, top + 0.2, side * (W / 2 - 0.06)), color));
    bodyParts.push(paint(at(boxNoBottom(0.08, 0.4, W - 0.12), bx0 + 0.04, top + 0.2, 0), color));
    // Bed floor reads dark so the open bed shows from above.
    bodyParts.push(paint(at(new THREE.PlaneGeometry(bl, W - 0.2).rotateX(-Math.PI / 2), (bx0 + bx1) / 2, top + 0.01, 0), METAL));
    bodyParts.push(paint(at(boxNoBottom(0.9, 0.45, 0.9), (bx0 + bx1) / 2, top + 0.225, 0), METAL));
  }

  const spikes = buildSpikesGeometry(spec);
  if (spikes) bodyParts.push(spikes);

  if (spec.spoiler) {
    const wedge = style === 'wedge';
    const sx = -L / 2 + 0.22;
    const y = topY(sx) + (wedge ? 0.42 : 0.3);
    bodyParts.push(paint(at(boxNoBottom(wedge ? 0.45 : 0.32, 0.05, W * 0.94), sx, y, 0), shade(color, STRIPE_SHADE)));
    for (const z of [-0.3 * W, 0.3 * W]) bodyParts.push(paint(at(boxNoBottom(0.08, y - topY(sx), 0.06), sx, (y + topY(sx)) / 2, z), METAL));
  }

  // Lights: head white, tail red; tail vertices are rewritten when braking.
  for (const z of [-(W / 2 - 0.32), W / 2 - 0.32]) {
    headParts.push(at(boxNoBottom(0.14, 0.12, 0.38), L / 2 - 0.05, topY(L / 2 - 0.05) - 0.05, z));
    tailParts.push(at(boxNoBottom(0.12, 0.12, 0.45), -L / 2 + 0.05, topY(-L / 2 + 0.05) - 0.05, z));
  }
  const heads = headParts.map((g) => paint(g, HEAD_LIGHT, HEAD_INTENSITY));
  const tails = tailParts.map((g) => paint(g, TAIL_LIGHT, TAIL_INTENSITY));
  const tailStart = heads.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const lightsGeo = merge([...heads, ...tails]);

  // Gun on the roof front.
  const gunX = roof.x1 - 0.3;
  const gunY = roofY + 0.04 + 0.09;
  gunParts.push(paint(at(boxNoBottom(0.45, 0.18, 0.22), gunX, gunY, 0), GUN));
  const barrel = new THREE.CylinderGeometry(0.045, 0.045, 0.55, 5, 1, true);
  barrel.rotateZ(-Math.PI / 2);
  gunParts.push(paint(at(barrel, gunX + 0.45, gunY + 0.02, 0), GUN));

  const bodyMaterial = new THREE.MeshStandardMaterial({ ...flat, roughness: 0.55, metalness: 0.25 });
  const group = new THREE.Group();
  const add = (name: string, geo: THREE.BufferGeometry, mat: THREE.Material, shadow: boolean): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.castShadow = shadow;
    group.add(m);
    return m;
  };
  add('body', merge(bodyParts), bodyMaterial, true);
  if (glassParts.length) add('glass', merge(glassParts), new THREE.MeshStandardMaterial({ ...flat, roughness: 0.2, metalness: 0.3 }), true);
  const lightsMesh = add('lights', lightsGeo, new THREE.MeshBasicMaterial({ vertexColors: true }), false);
  add('gun', merge(gunParts), new THREE.MeshStandardMaterial({ ...flat, roughness: 0.5, metalness: 0.3 }), false);

  const wheelGeo = new THREE.CylinderGeometry(r, r, WHEEL_WIDTH, WHEEL_SEGMENTS);
  wheelGeo.rotateX(Math.PI / 2); // axle along z
  const wheelMat = new THREE.MeshStandardMaterial({ color: TIRE, roughness: 0.8, flatShading: true });
  const wheels: CarParts['wheels'] = [];
  for (const front of [true, false]) {
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set((front ? 0.36 : -0.36) * L, r, side * 0.5 * W);
      const mesh = new THREE.Mesh(wheelGeo, wheelMat);
      mesh.name = 'wheel';
      pivot.add(mesh);
      group.add(pivot);
      wheels.push({ pivot, mesh, front, side });
    }
  }

  return {
    group,
    // The livery is in the body's vertex colors: no marker needed.
    bodyMaterial,
    glows: [],
    lights: lightsMesh.geometry.getAttribute('color') as THREE.BufferAttribute,
    tailStart,
    wheels,
    muzzle: v3(gunX + 0.75, gunY, 0),
    nose: v3(L / 2, 0, 0),
    exhaust: v3(-L / 2 - 0.15, base + 0.25 * H, 0),
    hood: v3(L * 0.3, topY(L * 0.3) + 0.1, 0),
    rearWheels: [v3(-0.36 * L, 0, -0.5 * W), v3(-0.36 * L, 0, 0.5 * W)],
  };
}

export function buildCarMesh(spec: CarMeshSpec, color: string): THREE.Group {
  return buildCarParts(spec, color).group;
}

/** Visual front-wheel angle from yaw rate (snapshots carry no steer input). + = turning right. */
export const steerVisual = (angVel: number, length: number, speed: number): number =>
  clamp((angVel * length) / Math.max(Math.abs(speed), 1), -STEER_MAX, STEER_MAX);

export interface CarPose {
  x: number;
  z: number;
  rotY: number;
  speed: number;
  angVel: number;
  braking: boolean;
  hpFrac: number;
  wrecked: boolean;
}

/** Per-car runtime state: wheel spin and steer, brake lights, damage tint, wreck pose. */
export class CarRig {
  private spin = 0;
  private braking = false;
  private wrecked = false;
  private tint = 1;
  private lastX = NaN;
  private lastZ = NaN;

  constructor(
    readonly parts: CarParts,
    private readonly spec: CarMeshSpec,
  ) {}

  update(p: CarPose): void {
    const { group, wheels } = this.parts;
    group.position.set(p.x, 0, p.z);
    group.rotation.y = p.rotY;
    // Roll distance from the rendered motion along the nose direction (rotY = -heading).
    if (!Number.isNaN(this.lastX)) {
      const d = (p.x - this.lastX) * Math.cos(-p.rotY) + (p.z - this.lastZ) * Math.sin(-p.rotY);
      this.spin -= d / this.spec.wheelRadius;
    }
    this.lastX = p.x;
    this.lastZ = p.z;
    const steer = p.wrecked ? 0 : steerVisual(p.angVel, this.spec.length, p.speed);
    for (const w of wheels) {
      w.mesh.rotation.z = this.spin;
      // Turning right = heading increases = rotation.y decreases.
      w.pivot.rotation.y = w.front ? -steer : 0;
    }
    if (p.braking !== this.braking) {
      this.braking = p.braking;
      this.setTail(p.braking ? TAIL_BRAKING : TAIL_INTENSITY);
    }
    const tint = p.wrecked ? WRECK_TINT : 1 - DAMAGE_TINT * (1 - clamp(p.hpFrac, 0, 1));
    if (Math.abs(tint - this.tint) > 0.01) {
      this.tint = tint;
      this.parts.bodyMaterial.color.setScalar(tint);
      // The marker dims with the body and goes out on a wreck; full hp restores it.
      for (const g of this.parts.glows) g.color.copy(g.base).multiplyScalar(p.wrecked ? 0 : tint);
    }
    if (p.wrecked !== this.wrecked) {
      this.wrecked = p.wrecked;
      for (const w of wheels) {
        // Wheels sag and splay out from the hulk.
        w.pivot.rotation.x = p.wrecked ? w.side * 0.35 : 0;
        w.pivot.position.z = w.side * (0.5 * this.spec.width + (p.wrecked ? 0.12 : 0));
        w.pivot.position.y = this.spec.wheelRadius * (p.wrecked ? 0.8 : 1);
      }
      if (p.wrecked) {
        this.setTail(0);
        this.setHead(0);
      }
    }
  }

  private setTail(k: number): void {
    const a = this.parts.lights;
    const c = new THREE.Color(TAIL_LIGHT);
    for (let i = this.parts.tailStart; i < a.count; i++) a.setXYZ(i, c.r * k, c.g * k, c.b * k);
    a.needsUpdate = true;
  }

  private setHead(k: number): void {
    const a = this.parts.lights;
    for (let i = 0; i < this.parts.tailStart; i++) a.setXYZ(i, k, k, k);
    a.needsUpdate = true;
  }
}

/** Disposes every geometry and material under `root` (shared ones are disposed once, which three tolerates). */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh && !(o as THREE.Points).isPoints && !(o as THREE.Line).isLine) return;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) mat?.dispose();
  });
}
