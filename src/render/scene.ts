import * as THREE from 'three';
import type { Quality, TrackTheme } from '../shared/contracts';
import { themeFor, type ThemeDef } from './themes';

// design.md section 1, lighting table.
const SHADOW_MAP = 2048;
const SHADOW_BOX = 120; // m
const LIGHT_DISTANCE = 120; // m from the shadow target, along the light direction

export interface World {
  scene: THREE.Scene;
  hemi: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
}

export function createWorld(): World {
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight();
  const key = new THREE.DirectionalLight();
  const cam = key.shadow.camera;
  cam.left = cam.bottom = -SHADOW_BOX / 2;
  cam.right = cam.top = SHADOW_BOX / 2;
  cam.near = 1;
  cam.far = LIGHT_DISTANCE * 2;
  key.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.04;
  key.shadow.radius = 2;
  scene.add(hemi, key, key.target);
  return { scene, hemi, key };
}

/** The only code that turns a ThemeDef into scene settings (WP11 adds themes as data). */
export function applyTheme(world: World, theme: TrackTheme): ThemeDef {
  const t = themeFor(theme);
  world.scene.background = new THREE.Color(t.skyFog);
  world.scene.fog = new THREE.FogExp2(t.fog.color, t.fog.density);
  world.hemi.color.set(t.hemisphere.sky);
  world.hemi.groundColor.set(t.hemisphere.ground);
  world.hemi.intensity = t.hemisphere.intensity;
  world.key.color.set(t.key.color);
  world.key.intensity = t.key.intensity;
  world.key.userData.dir = new THREE.Vector3(t.key.direction.x, t.key.direction.y, t.key.direction.z).normalize();
  return t;
}

const right = new THREE.Vector3();
const up = new THREE.Vector3();
const p = new THREE.Vector3();

/**
 * Moves the key light and its shadow box with the camera target. The target is snapped to whole
 * shadow texels in light space so static shadows do not shimmer while the camera moves.
 */
export function followShadow(world: World, x: number, z: number): void {
  const dir = world.key.userData.dir as THREE.Vector3;
  const texel = SHADOW_BOX / SHADOW_MAP;
  right.crossVectors(dir, THREE.Object3D.DEFAULT_UP).normalize();
  up.crossVectors(right, dir).normalize();
  p.set(x, 0, z);
  const r = Math.round(p.dot(right) / texel) * texel;
  const u = Math.round(p.dot(up) / texel) * texel;
  const f = p.dot(dir);
  p.copy(right).multiplyScalar(r).addScaledVector(up, u).addScaledVector(dir, f);
  world.key.target.position.copy(p);
  world.key.position.copy(p).addScaledVector(dir, -LIGHT_DISTANCE);
}

/** Shadows and high-only dressing (WP27) on/off; materials recompile because the shadow map defines change. */
export function applyQuality(renderer: THREE.WebGLRenderer, world: World, q: Quality): void {
  const shadows = q === 'high';
  world.scene.traverse((o) => {
    if (o.userData.highOnly) o.visible = shadows;
  });
  renderer.shadowMap.type = THREE.PCFShadowMap;
  if (renderer.shadowMap.enabled === shadows && world.key.castShadow === shadows) return;
  renderer.shadowMap.enabled = shadows;
  world.key.castShadow = shadows;
  world.scene.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) mat.needsUpdate = true;
  });
}
