import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CARS } from '../content/cars';
import { AI_LIVERIES, PLAYER_LIVERY } from '../content/liveries';
import { buildQuickRaceSetup } from '../content/quickRace';
import type { Quality, RaceSnapshot, RendererOptions, SimEvent } from '../shared/contracts';
import { SIM_DT } from '../shared/contracts';
import { createFakeSim } from '../sim/fake';
import { buildCarMesh } from './carMesh';
import { preloadCarModels } from './carModel';
import { triangles } from './geo';
import { createRenderer, type DebugRenderer } from './index';
import { createPost } from './post';
import { applyQuality, applyTheme, createWorld, followShadow } from './scene';

const MAX_STEPS_PER_FRAME = 5;
const MAX_FRAME_DT = 0.1; // s, a hidden or stalled tab must not dump seconds of sim at once
const SEED = 7;
// Race camera at rest (design.md section 2) and the garage turntable framing (CarPreview).
const RACE_FOV = 34;
const RACE_HEIGHT = 46; // m
const RACE_BACK = 0.32; // z offset = height * 0.32
const GARAGE_FOV = 30;
const LINEUP_GAP = 1.2; // m between cars
const LINEUP_ROW = 4; // cars per row, so the lineup fits the harness pane at true race scale

type Stats = ReturnType<DebugRenderer['stats']>;

/**
 * ?harness=render[&roster=1][&quality=low]: the renderer on the fake sim with the real loop pattern
 * (fixed 60 Hz steps, accumulator, interpolation). roster=1 races all 8 roster cars instead of 4 ravens.
 * &lineup=1[&frame=1080]: every car side by side from the race camera (frame = show the center of a frame that many
 * px tall at its true pixel scale); &lineup=1&closeup=<id>[&top=1]: one car at garage distance.
 * &lineup=1&car=<id>&colors=5C7CFF,C6FF3D,...: that car once per driver colour (same-model rivals, WP30).
 */
export function mountRenderHarness(root: HTMLElement): void {
  const lineup = new URLSearchParams(window.location.search).get('lineup') === '1';
  (lineup ? mountLineup(root) : mount(root)).catch((err: unknown) => {
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

/**
 * Car art check (WP14): the roster in livery order, noses up the screen, in the scrapyard light with the high-quality
 * post stack. `window.__harness.lineup()` gives each car's id, bounding box (car frame) and triangle count.
 */
async function mountLineup(root: HTMLElement): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const closeup = params.get('closeup');
  const only = params.get('car');
  const colors = params.get('colors')?.split(',').map((c) => `#${c}`);
  const defs = only && colors ? colors.map(() => CARS[only]).filter(Boolean) : Object.values(CARS).filter((d) => !closeup || d.id === closeup);
  if (!defs.length) throw new Error(`unknown car '${closeup ?? only}'`);
  await preloadCarModels(defs.map((d) => d.mesh));

  root.style.cssText += ';position:fixed;inset:0;margin:0;overflow:hidden;background:#0B0D10';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  root.append(canvas);
  const gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  gl.toneMapping = THREE.NoToneMapping; // the composer's AGX pass tone maps
  const world = createWorld();
  const theme = applyTheme(world, 'scrapyard');
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: theme.asphalt, roughness: 0.9 }));
  ground.receiveShadow = true;
  world.scene.add(ground);
  followShadow(world, 0, 0);

  const liveries = colors ?? [PLAYER_LIVERY, ...AI_LIVERIES];
  const cars = defs.map((def, i) => {
    const group = buildCarMesh(def.mesh, liveries[i % liveries.length]);
    const box = new THREE.Box3().setFromObject(group);
    let tris = 0;
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) tris += triangles((o as THREE.Mesh).geometry);
    });
    return { def, group, box, tris };
  });
  // Rows of cars side by side along x, nose toward -z (up the screen: rotation.y = -heading with heading -pi/2).
  const pitch = Math.max(...cars.map((c) => c.def.mesh.length)) + 2 * LINEUP_GAP;
  const rows = Math.ceil(cars.length / LINEUP_ROW);
  for (let r = 0; r < rows; r++) {
    const row = cars.slice(r * LINEUP_ROW, (r + 1) * LINEUP_ROW);
    let cursor = -(row.reduce((w, c) => w + c.def.mesh.width, 0) + LINEUP_GAP * (row.length - 1)) / 2;
    for (const c of row) {
      c.group.rotation.y = Math.PI / 2;
      c.group.position.set(cursor + c.def.mesh.width / 2, 0, (r - (rows - 1) / 2) * pitch);
      cursor += c.def.mesh.width + LINEUP_GAP;
      world.scene.add(c.group);
    }
  }

  const camera = new THREE.PerspectiveCamera(closeup ? GARAGE_FOV : RACE_FOV, 1, closeup ? 0.1 : 1, 600);
  if (!closeup) camera.position.set(0, RACE_HEIGHT, RACE_HEIGHT * RACE_BACK);
  else if (params.get('top') === '1') camera.position.set(0, cars[0].def.mesh.length * 2.6, 0.001);
  else {
    // Garage distance as in CarPreview, turned like the sheets' hero view (nose to the front left).
    const { length, width, height } = cars[0].def.mesh;
    const size = Math.max(length, width * 1.6);
    cars[0].group.rotation.y = Math.PI + 0.6;
    camera.position.set(0, size * 0.75, size * 1.85);
    camera.lookAt(0, height * 0.5, 0);
  }
  if (!closeup || params.get('top') === '1') camera.lookAt(0, 0, 0);
  applyQuality(gl, world, 'high');
  const post = createPost(gl, world.scene, camera);

  const labels = cars.map((c, i) => {
    const el = document.createElement('div');
    el.textContent = colors ? `${c.def.id.toUpperCase()} ${colors[i]}` : c.def.id.toUpperCase();
    el.style.cssText = 'position:absolute;transform:translateX(-50%);color:#E8EAED;font:12px monospace;text-shadow:0 0 3px #000';
    if (!closeup) root.append(el);
    return el;
  });
  const anchor = new THREE.Vector3();
  const frameH = closeup ? 0 : Number(params.get('frame')) || 0;
  let w = 0;
  let h = 0;
  const frame = (): void => {
    if (canvas.clientWidth !== w || canvas.clientHeight !== h) {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      gl.setSize(w, h, false);
      post.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      if (frameH) {
        const fw = (frameH * 16) / 9;
        camera.aspect = fw / frameH;
        camera.setViewOffset(fw, frameH, (fw - w) / 2, (frameH - h) / 2, w, h);
      }
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      cars.forEach((c, i) => {
        anchor.set(c.group.position.x, 0, c.group.position.z + c.def.mesh.length / 2 + 0.8).project(camera);
        labels[i].style.left = `${((anchor.x + 1) / 2) * w}px`;
        labels[i].style.top = `${((1 - anchor.y) / 2) * h}px`;
      });
    }
    post.render(0);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  window.__harness = {
    lineup: () =>
      cars.map((c) => ({
        id: c.def.id,
        imported: !c.group.getObjectByName('wheel'),
        box: { min: c.box.min.toArray(), max: c.box.max.toArray(), size: c.box.getSize(new THREE.Vector3()).toArray() },
        triangles: c.tris,
      })),
    stats: () => ({ drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles }),
  };
}
