import * as THREE from 'three';
import type { CarMeshSpec, GhostPose } from '../shared/contracts';
import { buildCarParts } from './carMesh';

/** WP40: the time trial ghost's see-through strength, and a pale glow so it reads as a ghost on dark asphalt. */
export const GHOST_OPACITY = 0.45;
export const GHOST_GLOW = '#9fd8ff';
export const GHOST_GLOW_INTENSITY = 0.35;

export interface GhostCar {
  readonly group: THREE.Group;
  setPose(p: GhostPose): void;
}

/**
 * A translucent copy of the car model (CCR-15): own material clones (imported models share theirs across cars),
 * no depth write so it never hides the player's car, no shadow, and the head and tail lights left out.
 */
export function buildGhostCar(spec: CarMeshSpec, color: string): GhostCar {
  const parts = buildCarParts(spec, color, 'none');
  const group = parts.group;
  const lights: THREE.Object3D[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.name === 'lights') {
      lights.push(m);
      return;
    }
    m.castShadow = false;
    m.receiveShadow = false;
    const one = (mat: THREE.Material): THREE.Material => {
      const c = mat.clone();
      c.transparent = true;
      c.opacity = GHOST_OPACITY;
      c.depthWrite = false;
      if (c instanceof THREE.MeshStandardMaterial) {
        c.emissive.set(GHOST_GLOW);
        c.emissiveIntensity = GHOST_GLOW_INTENSITY;
        c.emissiveMap = null;
      }
      return c;
    };
    m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material);
  });
  for (const l of lights) {
    l.removeFromParent();
    (l as THREE.Mesh).geometry.dispose();
  }
  group.visible = false;
  return {
    group,
    setPose(p) {
      group.position.set(p.x, 0, p.y);
      group.rotation.y = -p.heading;
      group.visible = true;
    },
  };
}
