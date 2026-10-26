import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import manifestFile from '../../public/models/cars/manifest.json';
import { CARS } from '../content/cars';
import type { CarMeshSpec } from '../shared/contracts';
import { buildCarParts, carMarkFromUrl, CarRig, DEFAULT_CAR_MARK, MARK_RIM, MARK_UNDERGLOW } from './carMesh';
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

  it('imported car: the model with its own body material, body paint unchanged, no roof plate', async () => {
    await preloadCarModels([SPEC], loader());
    for (const mark of ['rim', 'underglow', 'none'] as const) {
      const parts = buildCarParts(SPEC, '#2EA8FF', mark);
      expect(parts.wheels).toHaveLength(0);
      expect(parts.bodyMaterial).not.toBe(meshes(getCarModel(SPEC)!)[0].material);
      expect(parts.group.getObjectByName('roofPlate')).toBeUndefined();
      expect(parts.bodyMaterial.color.equals(new THREE.Color(1, 1, 1))).toBe(true);
      expect(parts.bodyMaterial.emissive.equals(new THREE.Color(0, 0, 0))).toBe(true);
    }
    expect(getRoofPlate(SPEC)).toEqual(BOX); // the manifest box stays in the data, unused
  });

  it('car marks: rim = fresnel uniform in the driver colour, no extra mesh; underglow = one additive quad under the car; none = nothing', async () => {
    await preloadCarModels([SPEC], loader());
    const glow = (k: number): THREE.Color => new THREE.Color('#2EA8FF').multiplyScalar(k);

    const rim = buildCarParts(SPEC, '#2EA8FF', 'rim');
    expect(meshes(rim.group)).toHaveLength(1);
    expect(rim.glows).toHaveLength(1);
    expect(rim.glows[0].color.equals(glow(MARK_RIM))).toBe(true);
    const shader = { uniforms: {} as Record<string, { value: unknown }>, fragmentShader: '#include <common>\n#include <emissivemap_fragment>', vertexShader: '' };
    rim.bodyMaterial.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, null as unknown as THREE.WebGLRenderer);
    expect(shader.uniforms.rimColor.value).toBe(rim.glows[0].color);
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance += rimColor');
    // Each car its own colour, one shared program.
    const other = buildCarParts(SPEC, '#FF3355', 'rim');
    expect(other.glows[0].color.equals(rim.glows[0].color)).toBe(false);
    expect(other.bodyMaterial.customProgramCacheKey()).toBe(rim.bodyMaterial.customProgramCacheKey());

    const under = buildCarParts(SPEC, '#2EA8FF', 'underglow');
    expect(meshes(under.group)).toHaveLength(2);
    const quad = under.group.getObjectByName('underglow') as THREE.Mesh;
    const mat = quad.material as THREE.MeshBasicMaterial;
    expect(mat.blending).toBe(THREE.AdditiveBlending);
    expect(mat.depthWrite).toBe(false);
    expect(mat.color.equals(glow(MARK_UNDERGLOW))).toBe(true);
    expect(quad.castShadow).toBe(false);
    quad.geometry.computeBoundingBox();
    const bb = quad.geometry.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeGreaterThan(SPEC.length);
    expect(quad.position.y).toBeLessThan(0.1);

    const none = buildCarParts(SPEC, '#2EA8FF', 'none');
    expect(meshes(none.group)).toHaveLength(1);
    expect(none.glows).toHaveLength(0);
  });

  it('?carMark falls back to the default when absent (node has no location)', () => {
    expect(carMarkFromUrl()).toBe(DEFAULT_CAR_MARK);
  });

  for (const mark of ['rim', 'underglow'] as const) {
    it(`${mark}: damage dims body and marker together (hp 50%), a wreck is dark with no marker, full hp restores both`, async () => {
      await preloadCarModels([SPEC], loader());
      const parts = buildCarParts(SPEC, '#C6FF3D', mark);
      const g = parts.glows[0];
      const base = g.color.clone();
      const rig = new CarRig(parts, SPEC);
      const pose = { x: 0, z: 0, rotY: 0, speed: 0, angVel: 0, braking: false, hpFrac: 1, wrecked: false };
      const near = (a: THREE.Color, b: THREE.Color): void => {
        expect(a.r).toBeCloseTo(b.r, 6);
        expect(a.g).toBeCloseTo(b.g, 6);
        expect(a.b).toBeCloseTo(b.b, 6);
      };
      rig.update({ ...pose, hpFrac: 0.5 });
      expect(parts.bodyMaterial.color.r).toBeCloseTo(1 - 0.45 * 0.5, 6);
      near(g.color, base.clone().multiplyScalar(1 - 0.45 * 0.5));
      rig.update({ ...pose, hpFrac: 0, wrecked: true });
      expect(parts.bodyMaterial.color.r).toBeCloseTo(0.2, 6);
      near(g.color, new THREE.Color(0, 0, 0));
      rig.update({ ...pose, hpFrac: 1 });
      near(parts.bodyMaterial.color, new THREE.Color(1, 1, 1));
      near(g.color, base);
    });
  }

  it('bumper spikes go onto the model front as one extra mesh', async () => {
    await preloadCarModels([SPEC], loader());
    const parts = buildCarParts({ ...SPEC, spikes: 2 }, '#FF5A1F', 'none');
    const spikes = parts.group.getObjectByName('spikes') as THREE.Mesh;
    spikes.geometry.computeBoundingBox();
    expect(spikes.geometry.boundingBox!.min.x).toBeCloseTo(SPEC.length / 2 - 0.04, 5);
    expect(meshes(parts.group)).toHaveLength(2); // model, spikes
  });

  it('every car model in the registry has its file and a manifest entry (the loader needs it; the plate box itself is unused since WP30)', () => {
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
