import * as THREE from 'three';
import type { CarMeshSpec, PropKind, PropPlacement, TrackGeometry } from '../shared/contracts';
import { createRng, type Rng } from '../shared/rng';
import { buildCarParts } from './carMesh';
import { boxNoBottom, merge, paint } from './geo';
import type { ThemeDef } from './themes';

// Fixed seed: barrel colors and rock shapes are the same on every boot.
const PROP_SEED = 0x9a0b5;
const POLE_HEIGHT = 8;
const ARM_LENGTH = 2.5;
const POOL_SIZE = 16; // m, lamp pool quad
const POLE_COLOR = '#4A4D52';
const BARREL_BLUE = '#5D6B78';
const CONE_COLOR = '#C8682E';
const ROCK_COLOR = '#5B544C';
const CACTUS_COLOR = '#4F6B45';
const BUILDING_COLOR = '#4E4A46';
const WRECK_COLOR = '#4A3B2C';
const WRECK_SPEC: CarMeshSpec = {
  style: 'compact',
  length: 4.2,
  width: 2,
  height: 0.7,
  cabinLength: 0.45,
  cabinOffset: -0.05,
  spoiler: false,
  wheelRadius: 0.38,
  model: null,
  spikes: 0,
};

/** The wreck prop: a compact car baked into one vertex-colored geometry, squashed. */
function wreckGeometry(): THREE.BufferGeometry {
  const parts = buildCarParts(WRECK_SPEC, WRECK_COLOR);
  parts.group.updateMatrixWorld(true);
  const geos: THREE.BufferGeometry[] = [];
  parts.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    // Wheels carry no colors and lights are HDR: repaint both dull. The other parts keep their vertex colors.
    geos.push(m.name === 'wheel' ? paint(g, '#1A1A1C') : m.name === 'lights' ? paint(g, '#2A2A2A') : g);
  });
  parts.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  });
  return merge(geos).scale(1, 0.6, 1).rotateZ(0.06);
}

function geometryFor(kind: PropKind, theme: ThemeDef, rng: Rng): THREE.BufferGeometry {
  switch (kind) {
    case 'crate':
      return paint(new THREE.BoxGeometry(1.4, 1.4, 1.4).translate(0, 0.7, 0), theme.propRust[1]);
    case 'tireStack': {
      const parts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 3; i++) parts.push(paint(new THREE.CylinderGeometry(0.65, 0.65, 0.32, 10).translate(i * 0.04, 0.16 + i * 0.33, -i * 0.03), theme.tireWall));
      parts.push(paint(new THREE.CircleGeometry(0.3, 10).rotateX(-Math.PI / 2).translate(0.08, 1.0, -0.06), '#050505'));
      return merge(parts);
    }
    case 'barrel': {
      // White body tinted per instance (rust or blue-grey); rings stay darker.
      const parts = [paint(new THREE.CylinderGeometry(0.45, 0.45, 1, 10).translate(0, 0.5, 0), '#ffffff')];
      for (const y of [0.3, 0.7]) parts.push(paint(new THREE.CylinderGeometry(0.47, 0.47, 0.06, 10, 1, true).translate(0, y, 0), '#8a8a8a'));
      return merge(parts);
    }
    case 'container': {
      // Ridge lines: alternating vertex color columns along the length, tinted per instance.
      const segs = 14;
      const g = paint(new THREE.BoxGeometry(6.1, 2.6, 2.4, segs, 1, 1).translate(0, 1.3, 0), '#ffffff');
      const p = g.getAttribute('position');
      const c = g.getAttribute('color') as THREE.BufferAttribute;
      for (let t = 0; t < p.count; t += 3) {
        const x = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3;
        const k = Math.floor(((x + 3.05) / 6.1) * segs) % 2 === 0 ? 1 : 0.8;
        for (let v = t; v < t + 3; v++) c.setXYZ(v, k, k, k);
      }
      return g;
    }
    case 'wreck':
      return wreckGeometry();
    case 'lightPole': {
      // Arm points along +x; instances are turned toward the track.
      return merge([
        paint(new THREE.CylinderGeometry(0.12, 0.16, POLE_HEIGHT, 6).translate(0, POLE_HEIGHT / 2, 0), POLE_COLOR),
        paint(boxNoBottom(ARM_LENGTH, 0.12, 0.12).translate(ARM_LENGTH / 2, POLE_HEIGHT - 0.1, 0), POLE_COLOR),
        paint(boxNoBottom(0.7, 0.16, 0.4).translate(ARM_LENGTH, POLE_HEIGHT - 0.12, 0), POLE_COLOR),
      ]);
    }
    case 'cone':
      return merge([
        paint(new THREE.ConeGeometry(0.3, 0.75, 8).translate(0, 0.375, 0), CONE_COLOR),
        paint(new THREE.CylinderGeometry(0.2, 0.23, 0.1, 8, 1, true).translate(0, 0.4, 0), '#D8D2C4'),
      ]);
    case 'rock': {
      const g = new THREE.IcosahedronGeometry(1.5, 0);
      const p = g.getAttribute('position');
      // Jitter shared vertices identically (IcosahedronGeometry is non-indexed): key by rounded position.
      const offsets = new Map<string, number>();
      for (let i = 0; i < p.count; i++) {
        const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
        if (!offsets.has(key)) offsets.set(key, rng.range(0.75, 1.15));
        const k = offsets.get(key) as number;
        p.setXYZ(i, p.getX(i) * k, Math.max(-0.2, p.getY(i) * k * 0.7), p.getZ(i) * k);
      }
      g.computeVertexNormals();
      return paint(g.translate(0, 0.8, 0), ROCK_COLOR);
    }
    case 'cactus':
      return merge([
        paint(new THREE.CylinderGeometry(0.22, 0.28, 3, 6).translate(0, 1.5, 0), CACTUS_COLOR),
        paint(new THREE.CylinderGeometry(0.14, 0.16, 1.1, 6).translate(0.45, 1.9, 0), CACTUS_COLOR),
        paint(new THREE.CylinderGeometry(0.14, 0.16, 0.9, 6).translate(-0.45, 1.5, 0), CACTUS_COLOR),
      ]);
    case 'building':
      return merge([
        paint(boxNoBottom(10, 6, 10).translate(0, 3, 0), BUILDING_COLOR),
        paint(boxNoBottom(10.6, 0.4, 10.6).translate(0, 6.2, 0), '#3A3734'),
      ]);
    default:
      // CCR-6 kinds (pine, snowbank, billboard, crane): a neutral block until WP22 models them.
      return paint(new THREE.BoxGeometry(1.4, 1.4, 1.4).translate(0, 0.7, 0), BUILDING_COLOR);
  }
}

/** One InstancedMesh per prop kind present on the track, plus bulbs and additive lamp pools for light poles. */
export function buildProps(track: TrackGeometry, theme: ThemeDef, glow: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  const rng = createRng(PROP_SEED);
  const byKind = new Map<PropKind, PropPlacement[]>();
  for (const p of track.def.props) byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), p]);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();

  for (const [kind, list] of byKind) {
    const mesh = new THREE.InstancedMesh(
      geometryFor(kind, theme, rng),
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, metalness: 0.1 }),
      list.length,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const poles = kind === 'lightPole' ? list : [];
    const bulbs = poles.length
      ? new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.06, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.sodiumLight).multiplyScalar(3) }), poles.length)
      : null;
    const pools = poles.length
      ? new THREE.InstancedMesh(
          new THREE.PlaneGeometry(POOL_SIZE, POOL_SIZE).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({
            map: glow,
            color: new THREE.Color(theme.sodiumLight).multiplyScalar(0.2),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
          poles.length,
        )
      : null;

    list.forEach((p, i) => {
      let rot = p.rotation;
      if (kind === 'lightPole') {
        // Turn the arm toward the nearest road point so the pool lands on the track.
        const pr = track.project(p.pos);
        rot = Math.atan2(pr.sample.pos.y - p.pos.y, pr.sample.pos.x - p.pos.x);
      }
      q.setFromAxisAngle(yAxis, -rot); // rotation follows the heading convention
      pos.set(p.pos.x, 0, p.pos.y);
      scl.setScalar(p.scale);
      mesh.setMatrixAt(i, m4.compose(pos, q, scl));
      if (kind === 'barrel') mesh.setColorAt(i, tint.set(rng.chance(0.5) ? theme.propRust[0] : BARREL_BLUE));
      if (kind === 'container') mesh.setColorAt(i, tint.set(rng.pick(theme.propRust)));
      if (kind === 'crate') mesh.setColorAt(i, tint.setScalar(rng.range(0.8, 1.1)));
      if (bulbs && pools) {
        const hx = p.pos.x + Math.cos(rot) * ARM_LENGTH * p.scale;
        const hz = p.pos.y + Math.sin(rot) * ARM_LENGTH * p.scale;
        bulbs.setMatrixAt(i, m4.compose(pos.set(hx, (POLE_HEIGHT - 0.22) * p.scale, hz), q, scl.setScalar(p.scale)));
        pools.setMatrixAt(i, m4.compose(pos.set(hx, 0.05, hz), q, scl.setScalar(1)));
      }
    });
    group.add(mesh);
    if (bulbs) group.add(bulbs);
    if (pools) group.add(pools);
  }
  return group;
}
