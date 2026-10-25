#!/usr/bin/env node
// WP14: art-incoming/cars/<id>/<id>.glb -> public/models/cars/<id>.glb + manifest.json (roof plate boxes).
// Measures every model (checks.md: never trust the generator), fits it to the hitbox rule, and exits 1 over a budget.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, getBounds, simplify, textureCompress, transformMesh, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { CARS } from '../../src/content/cars.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(root, 'art-incoming', 'cars');
const OUT = path.join(root, 'public', 'models', 'cars');

const MAX_TRIANGLES = 4000;
const MAX_TEXTURE = 1024; // px
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const ROUND = 0.05; // m, hitbox rounding
const CELL = 0.025; // m, top-down height map resolution
const FLAT_TOL = 0.07; // m, a plateau holds cells within this of its highest cell (the lofted roofs have a ~6 cm crown)
/** Collider area length x width from content.md section 1 before WP14: the hitbox rule keeps it (cars.ts holds the rounded result). */
const AREA = { raven: 4.2 * 2.0, outlaw: 3.8 * 2.0, iceberg: 4.9 * 2.1, scorch: 4.8 * 2.2, blaze: 4.4 * 2.0, titan: 5.2 * 2.4, viper: 4.5 * 2.0, wraith: 5.2 * 2.4 };
const DARK_BODY = ['raven', 'wraith']; // design.md "Car art": light edge trim on the roof plate

/**
 * Nose direction in the input file and how it was decided. Every input came from one Blender session that built
 * the nose at +x; the decision is checked by eye against each car's views/hero.png in the lineup close-ups.
 */
const FACING = {
  raven: ['+x', 'bull bar end (model-notes) = hero view front, close-up checked'],
  outlaw: ['+x', 'light bar on the front cage rail + tubular bumper end = hero view front, close-up checked'],
  iceberg: ['+x', 'bull bar end = hero view front, close-up checked'],
  scorch: ['+x', 'blower + steel guard end = hero view front, close-up checked'],
  blaze: ['+x', 'lip guard end, wing at the other = hero view front, close-up checked'],
  titan: ['+x', 'ram plate + spikes end = hero view front, close-up checked'],
  viper: ['+x', 'narrow lip guard end, tall wing at the other = hero view front, close-up checked'],
  wraith: ['+x', 'ram plate + 6 spikes end = hero view front, close-up checked'],
};
const NOSE_YAW = { '+x': 0, '-x': Math.PI, '+z': Math.PI / 2, '-z': -Math.PI / 2 }; // rotation about +y that turns the nose to +x

/**
 * Roof plate boxes set by hand, in input-file coordinates (x long, y up, z wide), where the detector cannot work:
 * OUTLAW's open cage has no panel (box on the top rails), ICEBERG's rack would hide a plate on the roof panel,
 * and TITAN's turret barrel splits the cab roof, so the detector keeps only the part in front of the barrel tip.
 */
const MANUAL_PLATE = {
  outlaw: { x0: -0.78, x1: 0.35, z0: -0.52, z1: 0.52, y: 1.64, why: 'cage top rails (model-notes)' },
  iceberg: { x0: -1.86, x1: 0.28, z0: -0.67, z1: 0.67, y: 1.885, why: 'roof rack top (model-notes)' },
  titan: { x0: -1.0, x1: 0.63, z0: -0.61, z1: 0.61, y: 1.84, why: 'whole cab roof under the barrel (flat roof vertices)' },
};

const round = (v) => Math.round(v / ROUND) * ROUND;
const fixed = (v, n = 3) => Number(v.toFixed(n));

/** Column-major mat4: uniform scale s, then translation t, applied after a rotation `yaw` about +y. */
function trs(yaw, s, t) {
  const c = Math.cos(yaw) * s;
  const n = Math.sin(yaw) * s;
  return [c, 0, -n, 0, 0, s, 0, 0, n, 0, c, 0, t[0], t[1], t[2], 1];
}

function triangleCount(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) throw new Error(`primitive mode ${prim.getMode()} (only TRIANGLES supported)`);
      n += (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3;
    }
  }
  return n;
}

/** Highest surface per CELL x CELL column seen from above (NaN = empty), over the scene bounds. */
function heightMap(doc, bounds) {
  const x0 = bounds.min[0];
  const z0 = bounds.min[2];
  const nx = Math.ceil((bounds.max[0] - x0) / CELL);
  const nz = Math.ceil((bounds.max[2] - z0) / CELL);
  const h = new Float32Array(nx * nz).fill(NaN);
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION').getArray();
      const idx = prim.getIndices()?.getArray() ?? Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
      for (let t = 0; t < idx.length; t += 3) {
        const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
        const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
        const bx = pos[b], by = pos[b + 1], bz = pos[b + 2];
        const cx = pos[c], cy = pos[c + 1], cz = pos[c + 2];
        const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(det) < 1e-12) continue; // vertical face: its top edge is covered by its neighbors
        const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - x0) / CELL));
        const i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - x0) / CELL));
        const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - z0) / CELL));
        const j1 = Math.min(nz - 1, Math.floor((Math.max(az, bz, cz) - z0) / CELL));
        for (let i = i0; i <= i1; i++) {
          const px = x0 + (i + 0.5) * CELL;
          for (let j = j0; j <= j1; j++) {
            const pz = z0 + (j + 0.5) * CELL;
            const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / det;
            const l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / det;
            const l3 = 1 - l1 - l2;
            if (l1 < 0 || l2 < 0 || l3 < 0) continue;
            const y = l1 * ay + l2 * by + l3 * cy;
            const k = i * nz + j;
            if (!(h[k] >= y)) h[k] = y;
          }
        }
      }
    }
  }
  return { h, nx, nz, x0, z0 };
}

/** Largest axis-aligned rectangle of `mask` cells (histogram method): [i0, j0, i1, j1] inclusive, or null. */
function largestRect(mask, nx, nz) {
  const heights = new Int32Array(nz);
  let best = null;
  let bestArea = 0;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) heights[j] = mask[i * nz + j] ? heights[j] + 1 : 0;
    const stack = [];
    for (let j = 0; j <= nz; j++) {
      const hj = j < nz ? heights[j] : 0;
      while (stack.length && heights[stack[stack.length - 1]] >= hj) {
        const top = stack.pop();
        const left = stack.length ? stack[stack.length - 1] + 1 : 0;
        const area = heights[top] * (j - left);
        if (area > bestArea) {
          bestArea = area;
          best = [i - heights[top] + 1, left, i, j - 1];
        }
      }
      stack.push(j);
    }
  }
  return best;
}

/**
 * The largest flat area visible from above: cells are grouped, highest first, into connected plateaus within
 * FLAT_TOL of their top cell; the plate box is the largest rectangle inside any plateau.
 */
function detectPlate(map) {
  const { h, nx, nz, x0, z0 } = map;
  const region = new Int32Array(nx * nz).fill(-1);
  const order = [...h.keys()].filter((k) => !Number.isNaN(h[k])).sort((a, b) => h[b] - h[a]);
  let best = null;
  let regions = 0;
  for (const seed of order) {
    if (region[seed] >= 0) continue;
    const id = regions++;
    const top = h[seed];
    const cells = [seed];
    region[seed] = id;
    for (let q = 0; q < cells.length; q++) {
      const k = cells[q];
      const i = Math.floor(k / nz);
      const j = k % nz;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
        const n = ni * nz + nj;
        if (region[n] < 0 && top - h[n] <= FLAT_TOL) {
          region[n] = id;
          cells.push(n);
        }
      }
    }
    if (best && cells.length <= best.area) continue; // a rectangle never beats its region's cell count
    const mask = new Uint8Array(nx * nz);
    for (const k of cells) mask[k] = 1;
    const r = largestRect(mask, nx, nz);
    const area = (r[2] - r[0] + 1) * (r[3] - r[1] + 1);
    if (!best || area > best.area) best = { area, r, top };
  }
  const [i0, j0, i1, j1] = best.r;
  return {
    x: fixed(x0 + ((i0 + i1 + 1) / 2) * CELL),
    z: fixed(z0 + ((j0 + j1 + 1) / 2) * CELL),
    length: fixed((i1 - i0 + 1) * CELL),
    width: fixed((j1 - j0 + 1) * CELL),
    y: fixed(best.top),
  };
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
fs.mkdirSync(OUT, { recursive: true });
const ids = fs.readdirSync(SRC).filter((id) => fs.existsSync(path.join(SRC, id, `${id}.glb`))).sort();
const manifest = {};
const rows = [];
let failed = false;

for (const id of ids) {
  const car = CARS[id];
  const facing = FACING[id];
  if (!car || !facing || !AREA[id]) throw new Error(`${id}: no car in src/content/cars.ts or no FACING / AREA entry`);
  const doc = await io.read(path.join(SRC, id, `${id}.glb`));
  const inFaces = triangleCount(doc);
  await doc.transform(flatten());
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];

  // Facing: the longest horizontal axis is the length, and it must agree with the nose decision.
  const raw = getBounds(scene);
  const alongX = raw.max[0] - raw.min[0] >= raw.max[2] - raw.min[2];
  if (alongX !== facing[0].endsWith('x')) throw new Error(`${id}: longest horizontal axis is ${alongX ? 'x' : 'z'}, FACING says ${facing[0]}`);
  for (const node of scene.listChildren()) {
    if (node.getMesh()) transformMesh(node.getMesh(), trs(NOSE_YAW[facing[0]], 1, [0, 0, 0]));
  }

  // Hitbox follows the art: keep content.md's area, take the model's top-view ratio, round, then fit uniformly.
  const b = getBounds(scene);
  const ml = b.max[0] - b.min[0];
  const mw = b.max[2] - b.min[2];
  const area = AREA[id];
  const length = round(Math.sqrt((area * ml) / mw));
  const width = round(Math.sqrt((area * mw) / ml));
  const s = Math.min(length / ml, width / mw);
  const fit = trs(0, s, [(-s * (b.min[0] + b.max[0])) / 2, -s * b.min[1], (-s * (b.min[2] + b.max[2])) / 2]);
  for (const node of scene.listChildren()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    transformMesh(mesh, fit);
    node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  }

  if (inFaces > MAX_TRIANGLES) {
    await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: (MAX_TRIANGLES / inFaces) * 0.95, error: 0.01 }));
  }
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [MAX_TEXTURE, MAX_TEXTURE] }));

  const out = getBounds(scene);
  const map = heightMap(doc, out);
  const manual = MANUAL_PLATE[id];
  let plate;
  if (manual) {
    // Same yaw (identity for +x) and fit as the mesh: scale about the input box center, wheels to y = 0.
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    plate = {
      x: fixed(s * ((manual.x0 + manual.x1) / 2 - cx)),
      z: fixed(s * ((manual.z0 + manual.z1) / 2 - cz)),
      length: fixed(s * (manual.x1 - manual.x0)),
      width: fixed(s * (manual.z1 - manual.z0)),
      y: fixed(s * (manual.y - b.min[1])),
    };
  } else plate = detectPlate(map);
  manifest[id] = { ...plate, ...(DARK_BODY.includes(id) ? { trim: true } : {}) };

  const file = path.join(OUT, `${id}.glb`);
  await io.write(file, doc);
  const outFaces = triangleCount(doc);
  const tex = doc.getRoot().listTextures().map((t) => ({ size: t.getSize() ?? [0, 0], mime: t.getMimeType() }));
  const maxTex = Math.max(0, ...tex.map((t) => Math.max(...t.size)));
  const bytes = fs.statSync(file).size;
  const over = outFaces > MAX_TRIANGLES || maxTex > MAX_TEXTURE;
  failed ||= over;
  rows.push({
    id,
    inFaces,
    outFaces,
    texture: tex.map((t) => `${t.size.join('x')} ${t.mime.split('/')[1]}`).join(', '),
    kB: (bytes / 1024).toFixed(1),
    bytes,
    facing: `nose ${facing[0]}: ${facing[1]}`,
    budget: over ? 'OVER' : 'ok',
  });
  console.log(
    `${id.padEnd(8)} model ${ml.toFixed(3)} x ${mw.toFixed(3)} (r ${(ml / mw).toFixed(3)}), A ${area.toFixed(2)}, cars.ts ${car.mesh.length} x ${car.mesh.width}` +
      ` -> hitbox ${length.toFixed(2)} x ${width.toFixed(2)}, scale ${s.toFixed(4)}, out ${(out.max[0] - out.min[0]).toFixed(3)} x ${(out.max[1] - out.min[1]).toFixed(3)} x ${(out.max[2] - out.min[2]).toFixed(3)}` +
      `, plate ${manual ? `manual (${manual.why})` : 'detected'} ${JSON.stringify(plate)}` +
      (Math.abs(car.mesh.length - length) > 1e-9 || Math.abs(car.mesh.width - width) > 1e-9 ? '  [cars.ts differs from the hitbox]' : ''),
  );
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const total = fs.readdirSync(OUT).reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
console.log();
console.table(rows.map(({ bytes, ...r }) => r));
console.log(`total public/models/cars: ${(total / 1024 / 1024).toFixed(2)} MB (budget ${MAX_TOTAL_BYTES / 1024 / 1024} MB)`);
if (total > MAX_TOTAL_BYTES) failed = true;
if (failed) {
  console.error('importCars: a car breaks a budget');
  process.exit(1);
}
