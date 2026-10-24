import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CARS } from '../content/cars';
import { buildQuickRaceSetup } from '../content/quickRace';
import type { Quality, RaceSnapshot, RendererOptions, SimEvent } from '../shared/contracts';
import { SIM_DT } from '../shared/contracts';
import { createFakeSim } from '../sim/fake';
import { createRenderer, type DebugRenderer } from './index';

const MAX_STEPS_PER_FRAME = 5;
const MAX_FRAME_DT = 0.1; // s, a hidden or stalled tab must not dump seconds of sim at once
const SEED = 7;

type Stats = ReturnType<DebugRenderer['stats']>;

/**
 * ?harness=render[&roster=1][&quality=low]: the renderer on the fake sim with the real loop pattern
 * (fixed 60 Hz steps, accumulator, interpolation). roster=1 races all 8 roster cars instead of 4 ravens.
 */
export function mountRenderHarness(root: HTMLElement): void {
  mount(root).catch((err: unknown) => {
    console.error(err);
    root.textContent = `render harness failed: ${err instanceof Error ? err.message : String(err)}`;
  });
}

async function mount(root: HTMLElement): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const roster = params.get('roster') === '1';
  const setup = buildQuickRaceSetup({ seed: SEED, aiCount: roster ? 7 : 3 });
  if (roster) {
    const defs = Object.values(CARS);
    setup.entrants.forEach((e, i) => {
      const def = defs[i % defs.length];
      e.carDefId = def.id;
      e.mesh = { ...def.mesh };
      e.stats = { ...def.base };
      e.hp = def.base.maxHp;
    });
  }
  const sim = createFakeSim(setup);

  root.style.cssText += ';position:fixed;inset:0;margin:0;overflow:hidden;background:#0B0D10';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  root.append(canvas);

  let quality: Quality = params.get('quality') === 'low' ? 'low' : 'high';
  let shake = true;
  const opts = (): RendererOptions => ({ canvas, track: sim.track, entrants: setup.entrants, playerCar: 0, quality, cameraShake: shake });
  let renderer = (await createRenderer(opts())) as DebugRenderer;
  let controls: OrbitControls | null = null;

  let prev: RaceSnapshot = sim.snapshot();
  let curr: RaceSnapshot = prev;
  let pending: SimEvent[] = [];
  let acc = 0;
  let paused = false;
  let w = 0;
  let h = 0;

  const stepOnce = (): void => {
    const ev = sim.step(new Map());
    for (const e of ev) pending.push(e);
    prev = curr;
    curr = sim.snapshot();
  };
  const draw = (alpha: number, dt: number): void => {
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw !== w || ch !== h) {
      w = cw;
      h = ch;
      renderer.resize(w, h, window.devicePixelRatio || 1);
    }
    controls?.update();
    renderer.render(prev, curr, alpha, pending, dt);
    pending = [];
  };

  // Live loop.
  let last = performance.now();
  let sampler: (() => void) | null = null;
  const frame = (now: number): void => {
    const dt = Math.min(MAX_FRAME_DT, (now - last) / 1000);
    last = now;
    if (!paused) {
      acc += dt;
      let n = 0;
      while (acc >= SIM_DT && n < MAX_STEPS_PER_FRAME) {
        stepOnce();
        acc -= SIM_DT;
        n++;
      }
      if (n === MAX_STEPS_PER_FRAME) acc = 0;
      draw(acc / SIM_DT, dt);
      sampler?.();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Overlay.
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:absolute;top:8px;left:8px;padding:8px 10px;background:rgba(11,13,16,0.78);color:#E8EAED;font:12px/1.5 monospace;border-radius:6px;user-select:none';
  const readout = document.createElement('div');
  const buttons = document.createElement('div');
  buttons.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;max-width:420px';
  panel.append(readout, buttons);
  root.append(panel);
  const button = (label: () => string, onClick: () => void): void => {
    const b = document.createElement('button');
    b.style.cssText = 'font:11px monospace;padding:2px 6px;background:#12151A;color:#E8EAED;border:1px solid rgba(255,255,255,0.18);border-radius:4px;cursor:pointer';
    const sync = (): void => {
      b.textContent = label();
    };
    b.onclick = () => {
      onClick();
      for (const s of syncs) s();
    };
    syncs.push(sync);
    sync();
    buttons.append(b);
  };
  const syncs: (() => void)[] = [];

  const setFree = (on: boolean): void => {
    controls?.dispose();
    controls = null;
    renderer.freeCamera = on;
    if (on) {
      const cam = renderer.camera;
      controls = new OrbitControls(cam, canvas);
      controls.target.set(cam.position.x, 0, cam.position.z - cam.position.y * 0.32);
      controls.update();
    }
  };

  const recreate = async (times: number): Promise<{ initial: Stats; after: Stats[]; sameRenderer: boolean }> => {
    const wasPaused = paused;
    paused = true;
    const gl = renderer.webgl;
    const follow = renderer.followCar;
    const free = renderer.freeCamera;
    draw(1, 0);
    const initial = renderer.stats();
    const after: Stats[] = [];
    let same = true;
    for (let i = 0; i < times; i++) {
      controls?.dispose();
      controls = null;
      renderer.dispose();
      renderer = (await createRenderer(opts())) as DebugRenderer;
      renderer.followCar = follow;
      same &&= renderer.webgl === gl;
      w = h = 0; // force resize on the new renderer
      draw(1, 0);
      after.push(renderer.stats());
    }
    setFree(free);
    console.log('render harness: recreate', { initial, after, sameRenderer: same });
    paused = wasPaused;
    return { initial, after, sameRenderer: same };
  };

  button(() => `quality: ${quality}`, () => {
    quality = quality === 'high' ? 'low' : 'high';
    renderer.setQuality(quality);
  });
  button(() => `shake: ${shake ? 'on' : 'off'}`, () => {
    shake = !shake;
    renderer.setCameraShake(shake);
  });
  for (let i = 0; i < Math.min(4, setup.entrants.length); i++) {
    button(() => `${renderer.followCar === i ? '*' : ''}follow ${i}`, () => (renderer.followCar = i));
  }
  button(() => `free orbit: ${renderer.freeCamera ? 'on' : 'off'}`, () => setFree(!renderer.freeCamera));
  button(() => 'explosion at player', () => {
    const p = curr.cars[renderer.followCar]?.pos ?? { x: 0, y: 0 };
    renderer.inject({ type: 'mineExploded', mine: -1, pos: { x: p.x, y: p.y }, hitCars: [] });
  });
  button(() => 'recreate x10', () => void recreate(10));

  setInterval(() => {
    const s = renderer.stats();
    readout.textContent = `fps ${s.fps}  draws ${s.drawCalls}  tris ${s.triangles}  geo ${s.geometries}  tex ${s.textures}  ${curr.phase} t ${curr.time.toFixed(1)}${paused ? '  PAUSED' : ''}`;
  }, 250);

  const harness = {
    sim,
    get renderer(): DebugRenderer {
      return renderer;
    },
    stats: (): Stats => renderer.stats(),
    snapshot: (): RaceSnapshot => curr,
    shadowsEnabled: (): boolean => renderer.webgl.shadowMap.enabled,
    setQuality(q: Quality) {
      quality = q;
      renderer.setQuality(q);
    },
    /** Freeze (true) or resume (false) the live loop; the last frame stays on screen. */
    pause(on: boolean) {
      paused = on;
      last = performance.now();
    },
    /** Pauses the live loop, then simulates `seconds` with one rendered frame per tick (dt = 1/60), so effects evolve as in real time. */
    advance(seconds: number): RaceSnapshot {
      paused = true;
      const n = Math.round(seconds / SIM_DT);
      for (let i = 0; i < n; i++) {
        stepOnce();
        draw(1, SIM_DT);
      }
      return curr;
    },
    /** Average live-loop fps and draw calls over `seconds` of real time. */
    measure(seconds: number): Promise<{ avgFps: number; frames: number; avgDrawCalls: number; maxDrawCalls: number; triangles: number; visibility: string }> {
      paused = false;
      return new Promise((resolve) => {
        // Real elapsed time, not the capped loop dt, so a throttled pane reports its true rate.
        const start = performance.now();
        let frames = 0;
        let draws = 0;
        let maxDraws = 0;
        sampler = () => {
          const t = (performance.now() - start) / 1000;
          frames++;
          const s = renderer.stats();
          draws += s.drawCalls;
          maxDraws = Math.max(maxDraws, s.drawCalls);
          if (t >= seconds) {
            sampler = null;
            resolve({ avgFps: frames / t, frames, avgDrawCalls: draws / frames, maxDrawCalls: maxDraws, triangles: s.triangles, visibility: document.visibilityState });
          }
        };
      });
    },
    recreate,
    follow(id: number) {
      renderer.followCar = id;
      for (const s of syncs) s();
    },
    explodeAtPlayer() {
      const p = curr.cars[renderer.followCar]?.pos ?? { x: 0, y: 0 };
      renderer.inject({ type: 'mineExploded', mine: -1, pos: { x: p.x, y: p.y }, hitCars: [] });
    },
  };
  window.__harness = harness;
}
