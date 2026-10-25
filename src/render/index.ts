import * as THREE from 'three';
import { COUNTDOWN_SECONDS } from '../content/race';
import type { CarId, Quality, Renderer, RendererOptions, SimEvent } from '../shared/contracts';
import { FollowCamera } from './camera';
import { buildCarParts, CarRig, disposeTree, type CarPose } from './carMesh';
import { preloadCarModels } from './carModel';
import { Fx, type CarFrame } from './fx';
import { interpolatePose, type Pose } from './interp';
import { createPost, type Post } from './post';
import { buildProps } from './props';
import { applyQuality, applyTheme, createWorld, followShadow } from './scene';
import { createWorldTextures } from './textures';
import { buildTrackMesh } from './trackMesh';

// design.md section 2, shake triggers.
const TRAUMA_IMPACT = 0.25;
const TRAUMA_IMPACT_SPEED = 8; // m/s
const TRAUMA_MINE = 0.4;
const TRAUMA_MINE_RANGE = 12; // m
const TRAUMA_WRECK = 0.6;
const TRAUMA_WRECK_RANGE = 15; // m
const MAX_PIXEL_RATIO = 2;
const MAX_ANISOTROPY = 8;
const FPS_WINDOW = 500; // ms

/** One GL context per canvas for the whole session, so renderer.info.memory counts stay comparable across races. */
const CACHE = new WeakMap<HTMLCanvasElement, THREE.WebGLRenderer>();

/** Extra hooks for the render harness and debugging; the game only uses `Renderer`. */
export interface DebugRenderer extends Renderer {
  readonly webgl: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  /** Car the camera, shake and shadow box follow (defaults to opts.playerCar). */
  followCar: CarId;
  /** true = the harness drives the camera (OrbitControls), the follow rig is paused. */
  freeCamera: boolean;
  /** Queues an effect-only event for the next render (harness "trigger explosion"). */
  inject(e: SimEvent): void;
}

export async function createRenderer(opts: RendererOptions): Promise<Renderer> {
  let webgl = CACHE.get(opts.canvas);
  if (!webgl) {
    webgl = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: false, powerPreference: 'high-performance' });
    CACHE.set(opts.canvas, webgl);
  }
  // Draw calls are summed over every pass of a frame (shadow, scene, post), so reset by hand once per frame.
  webgl.info.autoReset = false;
  const gl = webgl;

  const world = createWorld();
  const theme = applyTheme(world, opts.track.def.theme);
  const textures = createWorldTextures(theme, Math.min(MAX_ANISOTROPY, gl.capabilities.getMaxAnisotropy()));
  const track = buildTrackMesh(opts.track, theme, textures);
  world.scene.add(track.group, buildProps(opts.track, theme, textures.glow));

  await preloadCarModels(opts.entrants.map((e) => e.mesh));
  const rigs = opts.entrants.map((e) => {
    const parts = buildCarParts(e.mesh, e.color);
    world.scene.add(parts.group);
    return new CarRig(parts, e.mesh);
  });
  const fx = new Fx(opts.track, opts.entrants.length, textures.glow);
  world.scene.add(fx.group);
  const follow = new FollowCamera();

  const carPose: CarPose = { x: 0, z: 0, rotY: 0, speed: 0, angVel: 0, braking: false, hpFrac: 1, wrecked: false };
  const poses: Pose[] = opts.entrants.map(() => ({ x: 0, z: 0, heading: 0, rotY: 0 }));
  const frames: CarFrame[] = [];
  const injected: SimEvent[] = [];
  let quality: Quality = opts.quality;
  let shake = opts.cameraShake;
  let post: Post | null = null;
  let size = { w: opts.canvas.clientWidth || 1, h: opts.canvas.clientHeight || 1, pr: window.devicePixelRatio || 1 };
  let first = true;
  let fps = 0;
  let fpsFrames = 0;
  let fpsT = performance.now();
  let followCar = opts.playerCar;
  let freeCamera = false;

  const applySize = (): void => {
    gl.setPixelRatio(quality === 'high' ? Math.min(size.pr, MAX_PIXEL_RATIO) : 1);
    gl.setSize(size.w, size.h, false);
    post?.setSize(size.w, size.h);
    follow.camera.aspect = size.w / Math.max(1, size.h);
    follow.camera.updateProjectionMatrix();
  };

  const setQuality = (q: Quality): void => {
    quality = q;
    applyQuality(gl, world, q);
    fx.headlightCones = q === 'high';
    if (q === 'high') {
      gl.toneMapping = THREE.NoToneMapping; // the composer's AGX pass tone maps
      post ??= createPost(gl, world.scene, follow.camera);
    } else {
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      post?.dispose();
      post = null;
    }
    applySize();
  };

  const onEvent = (e: SimEvent): void => {
    const me = poses[followCar];
    const near = (p: { x: number; y: number }, r: number): boolean => !!me && Math.hypot(p.x - me.x, p.y - me.z) < r;
    switch (e.type) {
      case 'countdown':
        track.setLamps(e.value);
        break;
      case 'raceStart':
        track.setLamps('go');
        break;
      case 'impact':
        if ((e.a === followCar || e.b === followCar) && e.speed >= TRAUMA_IMPACT_SPEED) follow.addTrauma(TRAUMA_IMPACT);
        break;
      case 'mineExploded':
        if (near(e.pos, TRAUMA_MINE_RANGE)) follow.addTrauma(TRAUMA_MINE);
        break;
      case 'carWrecked':
        if (near(e.pos, TRAUMA_WRECK_RANGE)) follow.addTrauma(TRAUMA_WRECK);
        break;
      default:
        break;
    }
    fx.onEvent(e, frames);
  };

  setQuality(quality);
  // Compile every material up front so the first race frame does not hitch.
  await gl.compileAsync(world.scene, follow.camera);

  const renderer: DebugRenderer = {
    webgl: gl,
    camera: follow.camera,
    get followCar() {
      return followCar;
    },
    set followCar(id: CarId) {
      followCar = id;
      follow.reset();
    },
    get freeCamera() {
      return freeCamera;
    },
    set freeCamera(on: boolean) {
      freeCamera = on;
      if (!on) follow.reset();
    },
    inject: (e) => {
      injected.push(e);
    },

    render(prev, curr, alpha, events, dt) {
      gl.info.reset();
      for (let i = 0; i < rigs.length; i++) {
        const c = curr.cars[i];
        if (!c) continue;
        const pose = interpolatePose(prev.cars[i] ?? c, c, alpha, poses[i]);
        carPose.x = pose.x;
        carPose.z = pose.z;
        carPose.rotY = pose.rotY;
        carPose.speed = c.speed;
        carPose.angVel = c.angVel;
        carPose.braking = c.braking;
        carPose.hpFrac = c.maxHp > 0 ? c.hp / c.maxHp : 1;
        carPose.wrecked = c.wrecked;
        rigs[i].update(carPose);
        const f = (frames[i] ??= { x: 0, z: 0, heading: 0, state: c, parts: rigs[i].parts });
        f.x = pose.x;
        f.z = pose.z;
        f.heading = pose.heading;
        f.state = c;
      }
      if (first) {
        first = false;
        track.setLamps(curr.phase === 'countdown' ? 0 : 'go');
      }
      for (const e of events) onEvent(e);
      while (injected.length) onEvent(injected.shift() as SimEvent);

      const me = curr.cars[followCar];
      const pose = poses[followCar];
      if (me && pose) {
        if (!freeCamera) {
          follow.update(dt, {
            pos: { x: pose.x, y: pose.z },
            vel: me.vel,
            speed: me.speed,
            maxSpeed: opts.entrants[followCar]?.stats.maxSpeed ?? 1,
            phase: curr.phase,
            countdown: curr.countdown,
            countdownTotal: COUNTDOWN_SECONDS,
            wrecked: me.wrecked,
            turbo: me.turboActive,
            shake,
          });
        }
        followShadow(world, follow.target.x, follow.target.y);
      }
      fx.update(dt, frames, curr);

      if (post) post.render(dt);
      else gl.render(world.scene, follow.camera);

      fpsFrames++;
      const now = performance.now();
      if (now - fpsT >= FPS_WINDOW) {
        fps = (fpsFrames * 1000) / (now - fpsT);
        fpsFrames = 0;
        fpsT = now;
      }
    },

    resize(width, height, pixelRatio) {
      size = { w: Math.max(1, width), h: Math.max(1, height), pr: pixelRatio };
      applySize();
    },

    setQuality,

    setCameraShake(on) {
      shake = on;
    },

    stats() {
      const info = gl.info;
      return {
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        fps: Math.round(fps * 10) / 10,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      };
    },

    dispose() {
      post?.dispose();
      post = null;
      world.scene.traverse((o) => {
        if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
      });
      disposeTree(world.scene);
      for (const t of Object.values(textures)) t.dispose();
      world.key.dispose(); // frees the shadow map render target
      world.scene.clear();
      gl.renderLists.dispose();
    },
  };
  return renderer;
}

export { buildCarMesh } from './carMesh';
export { preloadCarModels } from './carModel';
