import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Geometry helpers shared by cars, props and the track. Every part is non-indexed with
 * position, normal and color only, so parts of one material merge into one draw call.
 */

const tmpColor = new THREE.Color();

/** Non-indexed copy (the input is disposed) with a flat vertex color; `k` scales the color (HDR for emissive parts). */
export function paint(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, k = 1): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  out.deleteAttribute('uv');
  if (!out.getAttribute('normal')) out.computeVertexNormals();
  tmpColor.set(color);
  const n = out.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = tmpColor.r * k;
    c[i * 3 + 1] = tmpColor.g * k;
    c[i * 3 + 2] = tmpColor.b * k;
  }
  out.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return out;
}

/** Merges painted parts and disposes them. */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts);
  if (!g) throw new Error('mergeGeometries failed: parts have different attributes');
  for (const p of parts) p.dispose();
  return g;
}

/** Box without its bottom face (never seen from the race camera): 10 triangles instead of 12. */
export function boxNoBottom(w: number, h: number, d: number): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  // BoxGeometry face order is px, nx, py, ny, pz, nz with 6 vertices each once non-indexed: drop ny.
  const keep = (a: THREE.BufferAttribute): THREE.BufferAttribute => {
    const s = a.itemSize;
    const arr = new Float32Array(30 * s);
    arr.set((a.array as Float32Array).subarray(0, 18 * s), 0);
    arr.set((a.array as Float32Array).subarray(24 * s, 36 * s), 18 * s);
    return new THREE.BufferAttribute(arr, s);
  };
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', keep(box.getAttribute('position') as THREE.BufferAttribute));
  out.setAttribute('normal', keep(box.getAttribute('normal') as THREE.BufferAttribute));
  box.dispose();
  return out;
}

const up = new THREE.Vector3(0, 1, 0);

/** Thin 4-sided open bar from a to b (8 triangles). */
export function bar(a: THREE.Vector3, b: THREE.Vector3, thickness: number): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(thickness / 2, thickness / 2, dir.length(), 4, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

export const triangles = (g: THREE.BufferGeometry): number => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
