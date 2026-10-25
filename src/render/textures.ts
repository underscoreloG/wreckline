import * as THREE from 'three';
import { createRng, type Rng } from '../shared/rng';
import type { DecalCell, ThemeDef } from './themes';

const SIZE = 512;
// Fixed seed: the world textures look the same on every boot.
const TEXTURE_SEED = 0x5eed;

function canvas2d(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable');
  return [c, ctx];
}

/** Speckles drawn with wrapped copies so the texture tiles without seams. */
function speckles(ctx: CanvasRenderingContext2D, rng: Rng, count: number, color: string, minSize: number, maxSize: number, alpha: number): void {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = rng.next() * SIZE;
    const y = rng.next() * SIZE;
    const s = rng.range(minSize, maxSize);
    ctx.globalAlpha = alpha * rng.range(0.4, 1);
    for (const dx of [-SIZE, 0, SIZE]) for (const dy of [-SIZE, 0, SIZE]) ctx.fillRect(x + dx, y + dy, s, s);
  }
  ctx.globalAlpha = 1;
}

function finish(c: HTMLCanvasElement, anisotropy: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}

export interface WorldTextures {
  asphalt: THREE.CanvasTexture;
  dirt: THREE.CanvasTexture;
  ground: THREE.CanvasTexture;
  /** White radial gradient in the alpha channel: lamp pools, scorch decals. */
  glow: THREE.CanvasTexture;
  /** WP27 decal atlas: white shapes in the alpha channel, tinted by vertex colors (decalUv). */
  decals: THREE.CanvasTexture;
}

const ATLAS = 512;
const CELL = 128;
const CELL_PAD = 3; // px kept empty around each cell against mipmap bleed
const CELLS: readonly DecalCell[] = ['soft', 'speckle', 'scrub', 'crack', 'patch', 'seam', 'skid', 'grid', 'stain', 'drift'];

/** UV rectangle [u0, v0, u1, v1] of a decal cell; v1 is the cell's top row in the canvas. */
export function decalUv(cell: DecalCell): [number, number, number, number] {
  const i = CELLS.indexOf(cell);
  const cx = (i % 4) * CELL;
  const cy = Math.floor(i / 4) * CELL;
  const pad = CELL_PAD + 1;
  return [(cx + pad) / ATLAS, 1 - (cy + CELL - pad) / ATLAS, (cx + CELL - pad) / ATLAS, 1 - (cy + pad) / ATLAS];
}

/** u runs across the road (0..1), v along it, one repeat per 8 m (trackMesh). */
function asphalt(theme: ThemeDef, rng: Rng, anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = canvas2d(SIZE);
  ctx.fillStyle = theme.asphalt;
  ctx.fillRect(0, 0, SIZE, SIZE);
  speckles(ctx, rng, 2600, '#000000', 1, 3, 0.25);
  speckles(ctx, rng, 1600, '#ffffff', 1, 2, 0.06);
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = theme.asphaltLine;
  // Dashed center line, 4 m on / 4 m off, and thin edge lines so the road edge reads from 55 m up.
  ctx.fillRect(SIZE / 2 - 3, 0, 6, SIZE / 2);
  ctx.fillRect(10, 0, 5, SIZE);
  ctx.fillRect(SIZE - 15, 0, 5, SIZE);
  // Worn paint: asphalt-colored chips eat into the markings; faint polished wheel lanes.
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.asphalt;
  for (let i = 0; i < 260; i++) {
    const x = rng.chance(0.5) ? SIZE / 2 - 4 + rng.range(0, 8) : rng.chance(0.5) ? rng.range(9, 16) : SIZE - rng.range(9, 16);
    ctx.globalAlpha = rng.range(0.4, 0.9);
    ctx.fillRect(x, rng.next() * SIZE, rng.range(1, 3), rng.range(1, 4));
  }
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.025;
  for (const u of [0.28, 0.4, 0.6, 0.72]) ctx.fillRect(u * SIZE - 14, 0, 28, SIZE);
  ctx.globalAlpha = 1;
  return finish(c, anisotropy);
}

function dirt(theme: ThemeDef, rng: Rng, anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = canvas2d(SIZE);
  ctx.fillStyle = theme.dirt;
  ctx.fillRect(0, 0, SIZE, SIZE);
  speckles(ctx, rng, 400, '#000000', 6, 20, 0.12);
  speckles(ctx, rng, 1800, theme.groundNoise, 2, 5, 0.5);
  return finish(c, anisotropy);
}

function ground(theme: ThemeDef, rng: Rng, anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = canvas2d(SIZE);
  ctx.fillStyle = theme.ground;
  ctx.fillRect(0, 0, SIZE, SIZE);
  speckles(ctx, rng, 300, '#000000', 10, 40, 0.1);
  speckles(ctx, rng, 2400, theme.groundNoise, 2, 6, 0.7);
  return finish(c, anisotropy);
}

function glow(): THREE.CanvasTexture {
  const [c, ctx] = canvas2d(128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Draws one atlas cell in white; (0, 0) is the cell's top-left, canvas y down = v down. */
function drawCell(ctx: CanvasRenderingContext2D, cell: DecalCell, rng: Rng): void {
  const m = CELL_PAD + 4;
  const mid = CELL / 2;
  const blob = (x: number, y: number, r: number, a: number): void => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const scatter = (count: number, f: (x: number, y: number) => void): void => {
    for (let i = 0; i < count; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(rng.next()) * (mid - m - 4);
      f(mid + Math.cos(a) * r, mid + Math.sin(a) * r);
    }
  };
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  switch (cell) {
    case 'soft':
      blob(mid, mid, mid - m, 0.7);
      for (let i = 0; i < 6; i++) blob(mid + rng.range(-18, 18), mid + rng.range(-18, 18), rng.range(18, 34), 0.35);
      break;
    case 'speckle':
      // Clumps instead of one disc, so gravel patches have ragged outlines.
      for (let k = 0; k < 5; k++) {
        const cx = mid + rng.range(-24, 24);
        const cy = mid + rng.range(-24, 24);
        for (let i = 0; i < 70; i++) {
          const a = rng.range(0, Math.PI * 2);
          const r = Math.abs(rng.range(-1, 1) * rng.range(0, 1)) * 30;
          ctx.globalAlpha = rng.range(0.4, 1);
          const sz = rng.range(1.5, 4);
          ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, sz, sz);
        }
      }
      scatter(60, (x, y) => {
        ctx.globalAlpha = rng.range(0.4, 1);
        const s = rng.range(1.5, 4);
        ctx.fillRect(x, y, s, s);
      });
      break;
    case 'scrub':
      ctx.lineWidth = 1.6;
      scatter(70, (x, y) => {
        ctx.globalAlpha = rng.range(0.5, 1);
        const a = -Math.PI / 2 + rng.range(-0.8, 0.8);
        const l = rng.range(4, 11);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        ctx.stroke();
      });
      break;
    case 'crack': {
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const walk = (x: number, y: number, a: number, steps: number, width: number): void => {
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let i = 0; i < steps; i++) {
          a += rng.range(-0.6, 0.6);
          x = Math.min(CELL - m, Math.max(m, x + Math.cos(a) * 6));
          y = Math.min(CELL - m, Math.max(m, y + Math.sin(a) * 6));
          ctx.lineTo(x, y);
          if (width > 1.2 && rng.chance(0.15)) walk(x, y, a + rng.range(-1.2, 1.2), Math.floor(steps / 2), width * 0.6);
        }
        ctx.stroke();
      };
      for (let k = 0; k < 4; k++) walk(mid, mid, (k * Math.PI) / 2 + rng.range(-0.5, 0.5), 9, 2.4);
      break;
    }
    case 'patch':
      ctx.fillRect(m + 2, m + 2, CELL - 2 * m - 4, CELL - 2 * m - 4);
      for (let i = 0; i < 40; i++) {
        const e = rng.int(0, 3);
        const t = rng.range(m, CELL - m - 6);
        const x = e === 0 ? m : e === 1 ? CELL - m - 4 : t;
        const y = e === 2 ? m : e === 3 ? CELL - m - 4 : t;
        ctx.fillRect(x, y, rng.range(2, 6), rng.range(2, 6));
      }
      break;
    case 'seam':
      ctx.lineWidth = 26;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let x = m; x <= CELL - m; x += 8) ctx.lineTo(x, mid + Math.sin(x * 0.11) * 14 + rng.range(-6, 6));
      ctx.stroke();
      break;
    case 'skid':
      // Two tyre streaks along v, fading in and out at the strip's ends.
      for (const x0 of [m + 4, CELL - m - 20]) {
        for (let y = m; y < CELL - m; y += 2) {
          const t = (y - m) / (CELL - 2 * m);
          ctx.globalAlpha = Math.sin(Math.PI * t) * rng.range(0.6, 1);
          ctx.fillRect(x0 + rng.range(-1, 1), y, 16, 2);
        }
      }
      break;
    case 'grid':
      ctx.fillRect(m, m, CELL - 2 * m, 14);
      ctx.fillRect(m, m, 10, CELL - 2 * m - 30);
      ctx.fillRect(CELL - m - 10, m, 10, CELL - 2 * m - 30);
      break;
    case 'stain':
      for (let i = 0; i < 7; i++) {
        ctx.globalAlpha = rng.range(0.5, 0.9);
        ctx.beginPath();
        ctx.ellipse(mid + rng.range(-20, 20), mid + rng.range(-20, 20), rng.range(8, 26), rng.range(6, 18), rng.range(0, Math.PI), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'drift':
      for (let i = 0; i < 7; i++) {
        ctx.globalAlpha = rng.range(0.4, 0.8);
        const y = rng.range(m + 12, CELL - m - 12);
        const g = ctx.createLinearGradient(m, 0, CELL - m, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(rng.range(0.3, 0.6), 'rgba(255,255,255,1)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(mid, y, mid - m, rng.range(3, 9), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
  }
  ctx.globalAlpha = 1;
}

function decals(rng: Rng, anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = canvas2d(ATLAS);
  CELLS.forEach((cell, i) => {
    ctx.save();
    ctx.translate((i % 4) * CELL, Math.floor(i / 4) * CELL);
    ctx.beginPath();
    ctx.rect(CELL_PAD, CELL_PAD, CELL - 2 * CELL_PAD, CELL - 2 * CELL_PAD);
    ctx.clip();
    drawCell(ctx, cell, rng);
    ctx.restore();
  });
  const t = finish(c, anisotropy);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function createWorldTextures(theme: ThemeDef, anisotropy: number): WorldTextures {
  const rng = createRng(TEXTURE_SEED);
  return {
    asphalt: asphalt(theme, rng, anisotropy),
    dirt: dirt(theme, rng, anisotropy),
    ground: ground(theme, rng, anisotropy),
    glow: glow(),
    decals: decals(rng, anisotropy),
  };
}
