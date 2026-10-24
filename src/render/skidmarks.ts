import * as THREE from 'three';

// design.md section 3.
export const SKID_SEGMENTS = 4000;
const SKID_WIDTH = 0.4;
const SKID_FADE = 0.25; // fraction of the buffer (the oldest) that fades out
const SKID_Y = 0.04;
const MIN_STEP = 0.3; // m between segment ends
const MAX_STEP = 3; // m, a longer jump is a teleport (car switch, respawn): no segment
const SKID_COLOR = '#0B0B0C';
const SKID_ALPHA = 0.75;

/** Ring buffer slots: push() hands out the next slot, age(slot) = 0 for the newest. */
export class SkidRing {
  head = -1; // newest slot
  written = 0;

  constructor(readonly size: number) {}

  push(): number {
    this.head = (this.head + 1) % this.size;
    this.written = Math.min(this.written + 1, this.size);
    return this.head;
  }

  age(slot: number): number {
    return (this.head - slot + this.size) % this.size;
  }
}

/** Opacity factor by age: full, then a linear fade over the oldest SKID_FADE of the buffer. */
export function skidFade(age: number, size: number): number {
  const start = size * (1 - SKID_FADE);
  return age < start ? 1 : Math.max(0, (size - age) / (size * SKID_FADE));
}

const VERT = /* glsl */ `
attribute float aSlot;
uniform float uHead;
uniform float uSize;
varying float vFade;
void main() {
  float age = mod(uHead - aSlot + uSize, uSize);
  float start = uSize * ${(1 - SKID_FADE).toFixed(3)};
  vFade = age < start ? 1.0 : max(0.0, (uSize - age) / (uSize * ${SKID_FADE.toFixed(3)}));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vFade;
void main() {
  gl_FragColor = vec4(uColor, ${SKID_ALPHA.toFixed(2)} * vFade);
  #include <colorspace_fragment>
}`;

export class Skidmarks {
  readonly mesh: THREE.Mesh;
  private readonly ring = new SkidRing(SKID_SEGMENTS);
  private readonly pos: THREE.BufferAttribute;
  private readonly uniforms: { uHead: { value: number }; uSize: { value: number }; uColor: { value: THREE.Color } };
  private readonly last = new Map<number, { x: number; z: number; on: boolean }>();

  constructor() {
    const n = SKID_SEGMENTS;
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const slot = new Float32Array(n * 4);
    const index = new Uint32Array(n * 6);
    for (let i = 0; i < n; i++) {
      slot.fill(i, i * 4, i * 4 + 4);
      index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
    }
    geo.setAttribute('position', this.pos);
    geo.setAttribute('aSlot', new THREE.BufferAttribute(slot, 1));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.setDrawRange(0, 0);
    this.uniforms = { uHead: { value: 0 }, uSize: { value: n }, uColor: { value: new THREE.Color(SKID_COLOR) } };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1; // under smoke and other transparent effects
  }

  /** Feeds one wheel's ground point; `on` = currently laying rubber. `key` identifies the wheel. */
  track(key: number, x: number, z: number, on: boolean): void {
    let l = this.last.get(key);
    if (!l) {
      l = { x, z, on: false };
      this.last.set(key, l);
    }
    if (!on) {
      l.on = false;
      return;
    }
    if (!l.on) {
      l.x = x;
      l.z = z;
      l.on = true;
      return;
    }
    const dx = x - l.x;
    const dz = z - l.z;
    const d = Math.hypot(dx, dz);
    if (d < MIN_STEP) return;
    if (d <= MAX_STEP) this.write(l.x, l.z, x, z, dx / d, dz / d);
    l.x = x;
    l.z = z;
  }

  private write(x0: number, z0: number, x1: number, z1: number, ux: number, uz: number): void {
    const s = this.ring.push();
    const px = -uz * (SKID_WIDTH / 2);
    const pz = ux * (SKID_WIDTH / 2);
    const a = this.pos.array as Float32Array;
    a.set([x0 + px, SKID_Y, z0 + pz, x0 - px, SKID_Y, z0 - pz, x1 + px, SKID_Y, z1 + pz, x1 - px, SKID_Y, z1 - pz], s * 12);
    this.pos.addUpdateRange(s * 12, 12);
    this.pos.needsUpdate = true;
    this.uniforms.uHead.value = this.ring.head;
    this.mesh.geometry.setDrawRange(0, this.ring.written * 6);
  }
}
