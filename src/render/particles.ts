import * as THREE from 'three';

/**
 * Pooled camera-facing particles (design.md section 3): one InstancedMesh per blend mode, fixed
 * capacity, struct-of-arrays state, no per-particle allocations. Quads face the camera in view
 * space; `stretch` > 0 turns a particle into a streak along its velocity (sparks, embers).
 */

const VERT = /* glsl */ `
attribute vec4 aPos;   // xyz, size
attribute vec4 aColor; // rgb, alpha
attribute vec4 aVel;   // xyz, stretch
varying vec4 vColor;
varying vec2 vUv;
void main() {
  vUv = position.xy * 2.0;
  vec4 mv = viewMatrix * vec4(aPos.xyz, 1.0);
  vec2 off = position.xy * aPos.w;
  if (aVel.w > 0.0) {
    vec2 v = (viewMatrix * vec4(aVel.xyz, 0.0)).xy;
    float l = length(v);
    if (l > 0.001) {
      vec2 d = v / l;
      off = d * position.x * (aPos.w + l * aVel.w) + vec2(-d.y, d.x) * position.y * aPos.w;
    }
  }
  mv.xy += off;
  vColor = aColor;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
varying vec4 vColor;
varying vec2 vUv;
void main() {
  float a = vColor.a * smoothstep(1.0, 0.25, length(vUv));
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor.rgb, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private n = 0;
  private readonly cap: number;
  // Per particle: px py pz vx vy vz age life s0 s1 r g b a0 a1 drag grav stretch
  private readonly st: Float32Array;
  private readonly aPos: THREE.InstancedBufferAttribute;
  private readonly aColor: THREE.InstancedBufferAttribute;
  private readonly aVel: THREE.InstancedBufferAttribute;
  private static readonly F = 18;

  constructor(capacity: number, additive: boolean) {
    this.cap = capacity;
    this.st = new Float32Array(capacity * Particles.F);
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.deleteAttribute('normal');
    geo.deleteAttribute('uv');
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aVel = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPos', this.aPos);
    geo.setAttribute('aColor', this.aColor);
    geo.setAttribute('aVel', this.aVel);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.frustumCulled = false; // instances live in attributes, the bounding sphere is meaningless
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  get alive(): number {
    return this.n;
  }

  /**
   * Positional on purpose: called for every particle, so no parameter object is allocated.
   * drag = 1/s exponential velocity damping, gravity = m/s^2 downward, stretch = s of velocity added to the streak length (0 = round).
   */
  spawn(
    x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size0: number, size1: number,
    r: number, g: number, b: number, a0: number, a1: number, drag: number, gravity: number, stretch: number,
  ): void {
    if (this.n >= this.cap) return;
    const o = this.n++ * Particles.F;
    const s = this.st;
    s[o] = x;
    s[o + 1] = y;
    s[o + 2] = z;
    s[o + 3] = vx;
    s[o + 4] = vy;
    s[o + 5] = vz;
    s[o + 6] = 0;
    s[o + 7] = life;
    s[o + 8] = size0;
    s[o + 9] = size1;
    s[o + 10] = r;
    s[o + 11] = g;
    s[o + 12] = b;
    s[o + 13] = a0;
    s[o + 14] = a1;
    s[o + 15] = drag;
    s[o + 16] = gravity;
    s[o + 17] = stretch;
  }

  update(dt: number): void {
    const F = Particles.F;
    const s = this.st;
    let i = 0;
    while (i < this.n) {
      const o = i * F;
      s[o + 6] += dt;
      if (s[o + 6] >= s[o + 7]) {
        // Swap-remove with the last live particle.
        const last = --this.n * F;
        if (last !== o) s.copyWithin(o, last, last + F);
        continue;
      }
      const damp = Math.exp(-s[o + 15] * dt);
      s[o + 3] *= damp;
      s[o + 4] = s[o + 4] * damp - s[o + 16] * dt;
      s[o + 5] *= damp;
      s[o] += s[o + 3] * dt;
      s[o + 1] = Math.max(0.05, s[o + 1] + s[o + 4] * dt);
      s[o + 2] += s[o + 5] * dt;
      i++;
    }
    const pos = this.aPos.array as Float32Array;
    const col = this.aColor.array as Float32Array;
    const vel = this.aVel.array as Float32Array;
    for (let k = 0; k < this.n; k++) {
      const o = k * F;
      const t = s[o + 6] / s[o + 7];
      const q = k * 4;
      pos[q] = s[o];
      pos[q + 1] = s[o + 1];
      pos[q + 2] = s[o + 2];
      pos[q + 3] = s[o + 8] + (s[o + 9] - s[o + 8]) * t;
      col[q] = s[o + 10];
      col[q + 1] = s[o + 11];
      col[q + 2] = s[o + 12];
      col[q + 3] = s[o + 13] + (s[o + 14] - s[o + 13]) * t;
      vel[q] = s[o + 3];
      vel[q + 1] = s[o + 4];
      vel[q + 2] = s[o + 5];
      vel[q + 3] = s[o + 17];
    }
    for (const a of [this.aPos, this.aColor, this.aVel]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, this.n * 4);
      a.needsUpdate = true;
    }
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0;
  }
}
