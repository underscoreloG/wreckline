import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CarMeshSpec } from '../shared/contracts';

/**
 * Imported car models (WP14). `scripts/assets/importCars.mjs` writes them facing +x, sized to the collider, wheels on
 * y = 0, plus the roof plate boxes in `manifest.json`. A model that fails to load stays procedural (buildCarMesh).
 */

/** Roof plate box in the car frame (+x forward, origin at the ground center); `trim` = light edge for dark bodies. */
export interface RoofPlateBox {
  x: number;
  z: number;
  length: number;
  width: number;
  y: number;
  trim?: boolean;
}

/** Fetchers, injectable so tests run without a network or a GPU. */
export interface CarModelLoader {
  model(url: string): Promise<THREE.Object3D>;
  manifest(url: string): Promise<Record<string, RoofPlateBox>>;
}

const MANIFEST = 'models/cars/manifest.json';

const defaultLoader: CarModelLoader = {
  model: async (url) => (await new GLTFLoader().loadAsync(url)).scene,
  manifest: async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return (await res.json()) as Record<string, RoofPlateBox>;
  },
};

const loaded = new Map<string, { scene: THREE.Object3D; plate: RoofPlateBox }>();
const jobs = new Map<string, Promise<void>>();
let manifest: Promise<Record<string, RoofPlateBox>> | null = null;

const url = (path: string): string => `${import.meta.env.BASE_URL}${path}`;
const carId = (path: string): string => path.slice(path.lastIndexOf('/') + 1).replace(/\.glb$/, '');

async function load(path: string, loader: CarModelLoader): Promise<void> {
  try {
    manifest ??= loader.manifest(url(MANIFEST));
    const [scene, plates] = await Promise.all([loader.model(url(path)), manifest]);
    const plate = plates[carId(path)];
    if (!plate) throw new Error(`no roof plate for '${carId(path)}' in ${MANIFEST}`);
    loaded.set(path, { scene, plate });
  } catch (err) {
    console.error(`carModel: ${path} failed to load, the car stays procedural`, err);
  }
}

/** Loads every distinct `spec.model` once (cached by path, a failure included); never rejects. */
export async function preloadCarModels(specs: readonly CarMeshSpec[], loader: CarModelLoader = defaultLoader): Promise<void> {
  const paths = new Set(specs.map((s) => s.model).filter((p): p is string => !!p));
  await Promise.all(
    [...paths].map((p) => {
      let job = jobs.get(p);
      if (!job) {
        job = load(p, loader);
        jobs.set(p, job);
      }
      return job;
    }),
  );
}

/** A clone of the loaded model sharing its geometry and materials, or null (not preloaded, failed, or procedural). */
export function getCarModel(spec: CarMeshSpec): THREE.Group | null {
  const e = spec.model ? loaded.get(spec.model) : undefined;
  if (!e) return null;
  const g = new THREE.Group();
  g.add(e.scene.clone());
  return g;
}

/** The manifest's roof plate box for a loaded model, else null. */
export function getRoofPlate(spec: CarMeshSpec): RoofPlateBox | null {
  return (spec.model && loaded.get(spec.model)?.plate) || null;
}

/** Forgets every model and the manifest (tests). */
export function resetCarModels(): void {
  loaded.clear();
  jobs.clear();
  manifest = null;
}
