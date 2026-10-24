import type { InputFrame, InputSource, PickupKind, RaceSnapshot, Sim, SimEvent, Vec2 } from '../shared/contracts';
import { NEUTRAL_INPUT, SIM_DT } from '../shared/contracts';
import { buildRacingLine } from '../sim/racingLine';

/** window.__harness while the debug view is mounted. Scripted checks drive the sim through it. */
export interface Debug2dHarness {
  sim: Sim;
  /** Steps n ticks and returns all their events in order. The first call stops real-time stepping for good. */
  step(n: number): SimEvent[];
  snapshot(): RaceSnapshot;
  /** Overrides car 0's keyboard input (unset fields neutral) until clearInput(). */
  setInput(partial: Partial<InputFrame>): void;
  clearInput(): void;
  /** sim.debugFinishRace(), then one step so its raceFinished event is returned. */
  finishRace(): SimEvent[];
}

export interface Debug2dHandle {
  harness: Debug2dHarness;
  dispose(): void;
}

export interface Debug2dOptions {
  /** Pause real-time stepping while the page is hidden or unfocused (default true, ?autopause=0 turns it off). */
  autopause?: boolean;
}

const MAX_STEPS_PER_FRAME = 5;
const MAX_FRAME_DT = 0.25;
const RECENT_EVENTS = 8;
const PICKUP_COLORS: Record<PickupKind, string> = { cash: '#6FCF5B', repair: '#FF4F5E', mines: '#FF9A3D', turbo: '#45E0FF' };

/** 2D top-down debug view of any Sim (real or fake), stepped at a fixed 60 Hz like the game loop. */
export function mountDebug2d(root: HTMLElement, sim: Sim, input?: InputSource, options: Debug2dOptions = {}): Debug2dHandle {
  const autopause = options.autopause ?? true;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab';
  root.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('debug2d: no 2D context');

  const track = sim.track;
  const colors = sim.setup.entrants.map((e) => e.color);
  const line = buildRacingLine(track, sim.setup.entrants[0]?.stats.grip ?? 0.8, sim.setup.entrants[0]?.stats.brake ?? 24);
  const racingLine: Vec2[] | null = line.offsets.some((o) => o !== 0)
    ? track.samples.map((s, i) => ({ x: s.pos.x + s.right.x * (line.offsets[i] ?? 0), y: s.pos.y + s.right.y * (line.offsets[i] ?? 0) }))
    : null;

  // ---- view transform (world m -> CSS px), fit to the walls, then pan/zoom with the mouse
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of [...track.leftWall, ...track.rightWall]) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const view = { scale: 1, x: 0, y: 0 };
  const fit = (): void => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    view.scale = Math.min(w / (maxX - minX + 40), h / (maxY - minY + 40));
    view.x = w / 2 - ((minX + maxX) / 2) * view.scale;
    view.y = h / 2 - ((minY + maxY) / 2) * view.scale;
  };
  // Checked every frame: the pane can mount hidden (0 x 0) and get its real size later.
  let fitted = false;
  const syncSize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    if (!fitted && w > 0 && h > 0) {
      fit();
      fitted = true;
    }
  };

  let drag: { x: number; y: number } | null = null;
  const onDown = (e: MouseEvent): void => {
    drag = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = 'grabbing';
  };
  const onMove = (e: MouseEvent): void => {
    if (!drag) return;
    view.x += e.clientX - drag.x;
    view.y += e.clientY - drag.y;
    drag = { x: e.clientX, y: e.clientY };
  };
  const onUp = (): void => {
    drag = null;
    canvas.style.cursor = 'grab';
  };
  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const k = Math.exp(-e.deltaY * 0.0015);
    view.x = mx - (mx - view.x) * k;
    view.y = my - (my - view.y) * k;
    view.scale *= k;
  };
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // ---- stepping
  let override: InputFrame | null = null;
  let scripted = false;
  const inputs = new Map<number, InputFrame>();
  const recent: string[] = [];
  const stepOnce = (): SimEvent[] => {
    inputs.set(0, override ?? input?.poll() ?? NEUTRAL_INPUT);
    const events = sim.step(inputs);
    for (const e of events) {
      recent.push('car' in e ? `${e.type} #${e.car}` : e.type);
      if (recent.length > RECENT_EVENTS) recent.shift();
    }
    return events;
  };

  const harness: Debug2dHarness = {
    sim,
    step(n: number): SimEvent[] {
      scripted = true;
      const all: SimEvent[] = [];
      for (let i = 0; i < n; i++) all.push(...stepOnce());
      return all;
    },
    snapshot: () => sim.snapshot(),
    setInput(partial) {
      override = { ...NEUTRAL_INPUT, ...partial };
    },
    clearInput() {
      override = null;
    },
    finishRace() {
      sim.debugFinishRace();
      return harness.step(1);
    },
  };
  window.__harness = harness;

  // ---- drawing
  const tx = (p: Vec2): [number, number] => [p.x * view.scale + view.x, p.y * view.scale + view.y];
  const poly = (pts: readonly Vec2[], closed: boolean): void => {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [x, y] = tx(p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (closed) ctx.closePath();
    ctx.stroke();
  };
  const circle = (p: Vec2, r: number, fill: string): void => {
    const [x, y] = tx(p);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, r * view.scale), 0, Math.PI * 2);
    ctx.fill();
  };

  let fps = 0;
  let frames = 0;
  let fpsT = performance.now();
  const draw = (snap: RaceSnapshot, mode: string): void => {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0B0D10';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#2A3038';
    poly(track.leftEdge, true);
    poly(track.rightEdge, true);
    ctx.strokeStyle = '#8A96A3';
    ctx.lineWidth = 2;
    poly(track.leftWall, true);
    poly(track.rightWall, true);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = '#3A424C';
    poly(track.samples.map((s) => s.pos), true);
    ctx.setLineDash([]);
    if (racingLine) {
      ctx.strokeStyle = '#3FB6A8';
      poly(racingLine, true);
    }

    ctx.font = '11px monospace';
    for (const cp of track.checkpoints) {
      ctx.strokeStyle = cp.index === 0 ? '#F2F2FF' : '#6B5A2A';
      ctx.lineWidth = cp.index === 0 ? 3 : 1;
      poly([cp.a, cp.b], false);
      const [x, y] = tx(cp.a);
      ctx.fillStyle = '#B59A4A';
      ctx.fillText(String(cp.index), x + 3, y - 3);
    }
    ctx.lineWidth = 1;

    for (const p of snap.pickups) circle(p.pos, 1.4, p.active ? PICKUP_COLORS[p.kind] : '#2A3038');
    for (const m of snap.mines) circle(m.pos, 0.8, m.armed ? '#FF3355' : '#FF9A3D');

    for (const c of snap.cars) {
      const e = sim.setup.entrants[c.id];
      if (!e) continue;
      const [x, y] = tx(c.pos);
      const L = e.mesh.length * view.scale;
      const W = e.mesh.width * view.scale;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(c.heading);
      ctx.fillStyle = c.wrecked ? '#4A4F57' : (colors[c.id] ?? '#FFFFFF');
      ctx.fillRect(-L / 2, -W / 2, L, W);
      ctx.fillStyle = '#0B0D10';
      ctx.fillRect(L / 2 - Math.max(2, L * 0.15), -W / 4, Math.max(2, L * 0.15), W / 2);
      ctx.restore();
      ctx.fillStyle = '#E8E8E8';
      ctx.fillText(`${c.id} ${Math.round(c.hp)}`, x + 6, y - 6);
    }

    const lines = [
      `tick ${snap.tick}  ${snap.phase}${snap.phase === 'countdown' ? ` ${snap.countdown.toFixed(2)}` : ''}  t ${snap.time.toFixed(2)}  fps ${fps}  ${mode}`,
      ...snap.cars.map((c) => {
        const flags = (['firing', 'gunOverheated', 'turboActive', 'drifting', 'braking', 'offroad', 'wrongWay', 'wrecked', 'finished'] as const)
          .filter((f) => c[f])
          .join(' ');
        return `#${c.id} ${sim.setup.entrants[c.id]?.name ?? ''}  P${c.position}  lap ${c.lap}/${snap.laps}  hp ${Math.round(c.hp)}  ${c.speed.toFixed(1)} m/s  ${flags}`;
      }),
      ...recent.map((r) => `  ${r}`),
    ];
    ctx.fillStyle = 'rgba(11,13,16,0.75)';
    ctx.fillRect(8, 8, 520, lines.length * 15 + 10);
    ctx.fillStyle = '#E8E8E8';
    ctx.font = '12px monospace';
    lines.forEach((l, i) => ctx.fillText(l, 16, 26 + i * 15));
  };

  let acc = 0;
  let last = performance.now();
  let raf = 0;
  const frame = (now: number): void => {
    const dt = Math.min(MAX_FRAME_DT, (now - last) / 1000);
    last = now;
    const paused = scripted || (autopause && (document.hidden || !document.hasFocus()));
    if (paused) {
      acc = 0;
    } else {
      acc += dt;
      let n = 0;
      while (acc >= SIM_DT && n < MAX_STEPS_PER_FRAME) {
        stepOnce();
        acc -= SIM_DT;
        n++;
      }
      if (n === MAX_STEPS_PER_FRAME) acc = 0; // drop the backlog instead of spiralling
    }
    frames++;
    if (now - fpsT >= 1000) {
      fps = Math.round((frames * 1000) / (now - fpsT));
      frames = 0;
      fpsT = now;
    }
    syncSize();
    draw(sim.snapshot(), scripted ? 'SCRIPTED' : paused ? 'PAUSED (unfocused)' : 'LIVE');
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    harness,
    dispose() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.remove();
      if (window.__harness === harness) delete window.__harness;
    },
  };
}
