#!/usr/bin/env node
// Prints the gzip size of every file in dist/assets and the total; fails over the SPEC.md section 8 budget.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const BUDGET = 2.5 * 1024 * 1024; // bytes, gzip total
const assets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'assets');

if (!fs.existsSync(assets)) {
  console.error(`bundleSize: ${assets} not found, run vite build first`);
  process.exit(1);
}

const kb = (n) => `${(n / 1024).toFixed(1).padStart(9)} kB`;
let total = 0;
for (const name of fs.readdirSync(assets).sort()) {
  const file = path.join(assets, name);
  if (!fs.statSync(file).isFile()) continue;
  const raw = fs.readFileSync(file);
  const gz = gzipSync(raw, { level: 9 }).length;
  total += gz;
  console.log(`${kb(raw.length)} raw ${kb(gz)} gzip  ${name}`);
}
console.log(`total gzip ${kb(total)} (budget ${kb(BUDGET)})`);
if (total > BUDGET) {
  console.error('bundleSize: over budget');
  process.exit(1);
}
