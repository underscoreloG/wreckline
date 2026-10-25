import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import manifestFile from '../../public/models/cars/manifest.json';
import { CARS } from '../content/cars';
import type { CarMeshSpec } from '../shared/contracts';
import { buildCarParts } from './carMesh';
import { getCarModel, getRoofPlate, preloadCarModels, resetCarModels, type CarModelLoader, type RoofPlateBox } from './carModel';

const SPEC: CarMeshSpec = { ...CARS.raven.mesh, model: 'models/cars/fixture.glb' };
const BOX: RoofPlateBox = { x: -0.2, z: 0.1, length: 1.2, width: 1, y: 1.3 };

const fixture = (): THREE.Group => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(SPEC.length, 1.2, SPEC.width).translate(0, 0.6, 0), new THREE.MeshStandardMaterial()));
  return g;
};
const loader = (plate: RoofPlateBox = BOX, model: () => Promise<THREE.Object3D> = async () => fixture()): CarModelLoader => ({
  model,
  manifest: async () => ({ fixture: plate }),
});
const meshes = (o: THREE.Object3D): THREE.Mesh[] => {
  const out: THREE.Mesh[] = [];
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) out.push(c as THREE.Mesh);
  });
  return out;
};

describe('render: car models', () => {
  beforeEach(() => resetCarModels());
  afterEach(() => vi.restoreAllMocks());

  it('falls back to the procedural car when a model fails to load', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await preloadCarModels([SPEC], loader(BOX, () => Promise.reject(new Error('404'))));
    expect(error).toHaveBeenCalled();
    expect(getCarModel(SPEC)).toBeNull();
    const parts = buildCarParts(SPEC, '#FF5A1F');
    expect(parts.wheels).toHaveLength(4);
    expect(parts.group.getObjectByName('body')).toBeDefined();
  });

  it('falls back when the manifest has no roof plate for the model', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await preloadCarModels([SPEC], { model: async () => fixture(), manifest: async () => ({}) });
    expect(getCarModel(SPEC)).toBeNull();
  });

  it('loads each path once; a clone shares geometry and materials', async () => {
    const model = vi.fn(async () => fixture());
    await preloadCarModels([SPEC, SPEC], loader(BOX, model));
    await preloadCarModels([SPEC], loader(BOX, model));
    expect(model).toHaveBeenCalledTimes(1);
    const [a, b] = [getCarModel(SPEC)!, getCarModel(SPEC)!];
    expect(a).not.toBe(b);
    const [ma, mb] = [meshes(a)[0], meshes(b)[0]];
    expect(ma).not.toBe(mb);
    expect(ma.geometry).toBe(mb.geometry);
    expect(ma.material).toBe(mb.material);
  });

  it('imported car: the model, its own tintable body material, the roof plate sized and placed from the manifest', async () => {
    await preloadCarModels([SPEC], loader());
    const parts = buildCarParts(SPEC, '#2EA8FF');
    expect(parts.wheels).toHaveLength(0);
    expect(parts.bodyMaterial).not.toBe(meshes(getCarModel(SPEC)!)[0].material);
    const plate = parts.group.getObjectByName('roofPlate') as THREE.Mesh;
    plate.geometry.computeBoundingBox();
    const bb = plate.geometry.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(BOX.length * 0.95, 5);
    expect(bb.max.z - bb.min.z).toBeCloseTo(BOX.width * 0.95, 5);
    expect((bb.max.x + bb.min.x) / 2).toBeCloseTo(BOX.x, 5);
    expect((bb.max.z + bb.min.z) / 2).toBeCloseTo(BOX.z, 5);
    expect(bb.min.y).toBeCloseTo(BOX.y, 5);
    expect(getRoofPlate(SPEC)).toEqual(BOX);
  });

  it('dark bodies: the trim widens the plate by its edge on each side', async () => {
    await preloadCarModels([SPEC], loader({ ...BOX, trim: true }));
    const plate = buildCarParts(SPEC, '#FF5A1F').group.getObjectByName('roofPlate') as THREE.Mesh;
    plate.geometry.computeBoundingBox();
    const bb = plate.geometry.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(BOX.length * 0.95 + 0.2, 5);
  });

  it('bumper spikes go onto the model front as one extra mesh', async () => {
    await preloadCarModels([SPEC], loader());
    const parts = buildCarParts({ ...SPEC, spikes: 2 }, '#FF5A1F');
    const spikes = parts.group.getObjectByName('spikes') as THREE.Mesh;
    spikes.geometry.computeBoundingBox();
    expect(spikes.geometry.boundingBox!.min.x).toBeCloseTo(SPEC.length / 2 - 0.04, 5);
    expect(meshes(parts.group)).toHaveLength(3); // model, plate, spikes
  });

  it('every car model in the registry has its file and a roof plate in the manifest', () => {
    const manifest: Record<string, RoofPlateBox> = manifestFile;
    const files = Object.keys(import.meta.glob('../../public/models/cars/*.glb'));
    for (const car of Object.values(CARS)) {
      if (!car.mesh.model) continue;
      expect(files).toContain(`../../public/${car.mesh.model}`);
      const box = manifest[car.id];
      expect(box, car.id).toBeDefined();
      expect(box.length).toBeGreaterThan(0.5);
      expect(box.width).toBeGreaterThan(0.5);
      expect(Math.abs(box.x) + box.length / 2).toBeLessThanOrEqual(car.mesh.length / 2);
      expect(Math.abs(box.z) + box.width / 2).toBeLessThanOrEqual(car.mesh.width / 2);
    }
  });
});
