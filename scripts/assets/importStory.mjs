#!/usr/bin/env node
// WP36 story art import (dev machine only). Reads the user's Gemini images <id>.jpg (2752x1536) from a folder outside
// the repo (default the main checkout's story-art/, gitignored) and writes public/story/<id>.webp: a centre crop to
// 16:9, resized to 1600x900, no retouching. Each image gets the highest WebP quality from QUALITIES that keeps it
// under MAX_BYTES (about 150-250 kB each).
// Usage: node scripts/assets/importStory.mjs [source folder]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const IN_DIR = path.resolve(process.argv[2] ?? '/Users/kevin/Downloads/Claude/wreckline/story-art');
const OUT_DIR = path.join(ROOT, 'public', 'story');

const IDS = [
  'beat-intro', 'beat-vex', 'beat-razor', 'beat-duchess', 'beat-warden', 'beat-ending',
  'scrapyard', 'dustBowl', 'dockside', 'frostbite', 'neonMile', 'redrock', 'junkyardSprint', 'pineHollow',
  'rainDistrict', 'blastPit',
  'title-menu',
];
const W = 1600;
const H = 900;
const QUALITIES = [90, 86, 82, 78, 74, 70, 66, 62];
const MAX_BYTES = 250 * 1024;

fs.mkdirSync(OUT_DIR, { recursive: true });
let total = 0;
for (const id of IDS) {
  const src = path.join(IN_DIR, `${id}.jpg`);
  // fit 'cover' with a centre position is the centre crop to 16:9
  const base = sharp(src).resize(W, H, { fit: 'cover', position: 'centre' });
  let out = null;
  let quality = 0;
  for (const q of QUALITIES) {
    out = await base.clone().webp({ quality: q, effort: 6 }).toBuffer();
    quality = q;
    if (out.length <= MAX_BYTES) break;
  }
  fs.writeFileSync(path.join(OUT_DIR, `${id}.webp`), out);
  total += out.length;
  console.log(`${id}.webp  q${quality}  ${(out.length / 1024).toFixed(0)} kB`);
}
console.log(`${IDS.length} files, total ${(total / 1024).toFixed(0)} kB`);
