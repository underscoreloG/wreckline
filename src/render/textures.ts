import * as THREE from 'three';
import { createRng, type Rng } from '../shared/rng';
import type { ThemeDef } from './themes';

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

export function createWorldTextures(theme: ThemeDef, anisotropy: number): WorldTextures {
  const rng = createRng(TEXTURE_SEED);
  return { asphalt: asphalt(theme, rng, anisotropy), dirt: dirt(theme, rng, anisotropy), ground: ground(theme, rng, anisotropy), glow: glow() };
}
