#!/usr/bin/env node
// Module boundary check (SPEC.md section 3, rules 1-3). Regex based on purpose: no parser dependency.
// Rules 4-5 (no snapshot mutation, who creates the sim) are not regex-checkable: reviewed by the brain.
// Usage: node scripts/checkBoundaries.mjs [--self-test]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PURE_DIRS = ['sim', 'shared', 'content', 'meta'];
const NO_CLOCK_DIRS = ['sim', 'shared', 'content'];
const FORBIDDEN_PACKAGES = ['three', 'postprocessing', 'react', 'react-dom'];
const FORBIDDEN_DIRS = ['render', 'ui', 'audio', 'input', 'game'];
const DOM_GLOBALS = /\b(window|document|localStorage|requestAnimationFrame)\b/g;
const CLOCK_RANDOM = /\b(Math\.random|Date\.now|performance\.now)\b/g;
// save.ts receives a storage adapter as a parameter; the word may appear there, the global may not (code review).
const LOCAL_STORAGE_OK = new Set(['meta/save.ts']);
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.mjs'];

/**
 * Blanks comments (and, with blankStrings, string and template literal bodies) while keeping
 * every newline and offset, so match indexes still map to the right line.
 */
function blank(src, blankStrings) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') {
        out += ' ';
        i++;
      }
    } else if (c === '/' && n === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      out += '  ';
      i += 2;
    } else if (c === "'" || c === '"' || c === '`') {
      out += c;
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') {
          out += blankStrings ? '  ' : src.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += blankStrings && src[i] !== '\n' ? ' ' : src[i];
        i++;
      }
      out += c;
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

function importSpecifiers(code) {
  const res = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?[\w*{}\s,$]*?\bfrom\s*(['"])([^'"]+)\1/g, // import x from '...', import { a,\n b } from '...'
    /\bimport\s*(['"])([^'"]+)\1/g, // import '...'
    /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g, // import('...')
    /\bexport\s+(?:type\s+)?[\w*{}\s,$]*?\bfrom\s*(['"])([^'"]+)\1/g, // export ... from '...'
  ];
  for (const re of patterns) {
    for (const m of code.matchAll(re)) res.push({ spec: m[2], index: m.index });
  }
  return res;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return walk(p);
    return EXTENSIONS.includes(path.extname(d.name)) && !d.name.endsWith('.d.ts') ? [p] : [];
  });
}

/** Returns violations as "src/rel/file.ts:line: message" strings for the src/ tree under root. */
export function check(root) {
  const srcDir = path.join(root, 'src');
  const violations = [];
  for (const file of walk(srcDir)) {
    const rel = path.relative(srcDir, file).split(path.sep).join('/');
    const top = rel.split('/')[0];
    const isPure = PURE_DIRS.includes(top);
    const isTest = /\.test\.tsx?$/.test(rel);
    const raw = fs.readFileSync(file, 'utf8');
    const code = blank(raw, false);
    const report = (index, msg) => violations.push(`src/${rel}:${lineOf(raw, index)}: ${msg}`);

    for (const { spec, index } of importSpecifiers(code)) {
      let target = null; // path relative to src/, without extension
      if (spec.startsWith('.')) {
        target = path.relative(srcDir, path.resolve(path.dirname(file), spec)).split(path.sep).join('/').replace(/\.(tsx?|mjs|js)$/, '');
      }
      if (isPure) {
        const pkg = FORBIDDEN_PACKAGES.find((p) => spec === p || spec.startsWith(`${p}/`));
        if (pkg) report(index, `rule 1: ${top}/ must not import '${spec}'`);
        const dir = target && FORBIDDEN_DIRS.find((d) => target === d || target.startsWith(`${d}/`));
        if (dir) report(index, `rule 1: ${top}/ must not import src/${dir} ('${spec}')`);
      }
      if (target === 'sim/internal' && top !== 'sim') report(index, `rule 3: only src/sim/** may import sim/internal ('${spec}')`);
    }

    const noStrings = blank(raw, true);
    if (isPure) {
      for (const m of noStrings.matchAll(DOM_GLOBALS)) {
        if (m[1] === 'localStorage' && LOCAL_STORAGE_OK.has(rel)) continue;
        report(m.index, `rule 1: ${top}/ must not use '${m[1]}'`);
      }
    }
    if (NO_CLOCK_DIRS.includes(top) && !isTest) {
      for (const m of noStrings.matchAll(CLOCK_RANDOM)) report(m.index, `rule 2: ${top}/ must not use '${m[1]}' (use world.rng / sim time)`);
    }
  }
  return violations;
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wreckline-boundaries-'));
  const put = (rel, body) => {
    const p = path.join(root, 'src', rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  };
  try {
    // Planted violations (one per line, each must be reported)
    put('sim/a.ts', "import * as THREE from 'three';\nexport const r = Math.random();\n");
    put('sim/b.ts', "import {\n  x,\n  y,\n} from '../render/scene';\nexport const t = Date.now();\n");
    put('shared/c.ts', "export const w = window.innerWidth;\nexport const n = performance.now();\n");
    put('content/d.ts', "export { Hud } from '../ui/hud/Hud';\nexport const lazy = () => import('../audio/index');\n");
    put('meta/e.ts', "import type { ReactElement } from 'react';\nlocalStorage.setItem('k', 'v');\n");
    put('ui/f.tsx', "import type { SimWorld } from '../sim/internal';\n");
    put('meta/g.ts', "import { createRoot } from 'react-dom/client';\nrequestAnimationFrame(() => {});\n");
    put('game/h.ts', "export * from '../sim/internal.ts';\n");
    put('content/i.ts', "import '../input/keyboard';\n");
    // Allowed: must not be reported
    put('sim/ok.ts', "// window document Math.random() import x from 'three'\n/* Date.now() from '../render/x' */\nexport const s = 'window document Math.random';\nimport type { SimWorld } from './internal';\nimport { a } from '../shared/math';\n");
    put('sim/ok.test.ts', "const t0 = performance.now();\n");
    put('meta/save.ts', 'export function save(localStorage: { setItem(k: string, v: string): void }) { localStorage.setItem("a", "b"); }\n');
    put('render/ok.ts', "import * as THREE from 'three';\nimport { createSim } from '../sim';\nwindow.addEventListener('resize', () => Math.random());\n");
    put('shared/types.d.ts', "declare const x: Window['document'];\n");

    const expected = [
      'src/content/d.ts:1: rule 1',
      'src/content/d.ts:2: rule 1',
      'src/content/i.ts:1: rule 1',
      'src/game/h.ts:1: rule 3',
      'src/meta/e.ts:1: rule 1',
      'src/meta/e.ts:2: rule 1',
      'src/meta/g.ts:1: rule 1',
      'src/meta/g.ts:2: rule 1',
      'src/shared/c.ts:1: rule 1',
      'src/shared/c.ts:2: rule 2',
      'src/sim/a.ts:1: rule 1',
      'src/sim/a.ts:2: rule 2',
      'src/sim/b.ts:1: rule 1',
      'src/sim/b.ts:5: rule 2',
      'src/ui/f.tsx:1: rule 3',
    ];
    const got = check(root)
      .map((v) => v.replace(/^(src\/[^:]+:\d+: rule \d).*$/, '$1'))
      .sort();
    const ok = JSON.stringify(got) === JSON.stringify(expected);
    if (!ok) {
      console.error('check:boundaries self-test FAILED');
      console.error('expected:\n  ' + expected.join('\n  '));
      console.error('got:\n  ' + got.join('\n  '));
      return false;
    }
    console.log(`check:boundaries self-test passed (${expected.length} planted violations caught, 5 allowed files clean)`);
    return true;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes('--self-test')) {
    process.exit(selfTest() ? 0 : 1);
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const violations = check(root);
  if (violations.length > 0) {
    console.error(`check:boundaries: ${violations.length} violation(s)`);
    for (const v of violations) console.error(`  ${v}`);
    process.exit(1);
  }
  console.log(`check:boundaries: ok (${walk(path.join(root, 'src')).length} files)`);
}
