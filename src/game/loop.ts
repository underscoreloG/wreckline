import { SIM_DT } from '../shared/contracts';

export const MAX_STEPS_PER_FRAME = 5;
// A stalled or hidden tab must not hand the renderer seconds of particle time at once.
const MAX_FRAME_DT = 0.1; // s

export interface Scheduler {
  request(cb: (now: number) => void): number;
  cancel(id: number): void;
}

export interface Loop {
  start(): void;
  stop(): void;
  setPaused(paused: boolean): void;
  isPaused(): boolean;
  /** One frame of `dt` seconds: up to MAX_STEPS_PER_FRAME steps, then one render. Returns the steps run. */
  advance(dt: number): number;
  /** Runs `n` sim steps now, no render (tests, debug). */
  stepManual(n: number): void;
}

const browserScheduler = (): Scheduler => ({
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
});

/** Fixed 60 Hz steps with an accumulator; the render gets alpha in [0,1) to blend the last two snapshots. */
export function createLoop(onStep: () => void, onRender: (alpha: number, dt: number) => void, scheduler: Scheduler = browserScheduler()): Loop {
  let acc = 0;
  let paused = false;
  let last: number | null = null;
  let id = 0;
  let running = false;

  const advance = (rawDt: number): number => {
    if (paused) return 0;
    const dt = Math.min(MAX_FRAME_DT, Math.max(0, rawDt));
    acc += dt;
    let n = 0;
    while (acc >= SIM_DT && n < MAX_STEPS_PER_FRAME) {
      onStep();
      acc -= SIM_DT;
      n++;
    }
    // Drop what the frame could not catch up on, so a slow frame never snowballs.
    if (acc >= SIM_DT) acc = 0;
    onRender(acc / SIM_DT, dt);
    return n;
  };

  const frame = (now: number): void => {
    if (!running) return;
    id = scheduler.request(frame);
    const dt = last === null ? 0 : (now - last) / 1000;
    last = now;
    advance(dt);
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = null;
      id = scheduler.request(frame);
    },
    stop() {
      running = false;
      scheduler.cancel(id);
    },
    setPaused(p) {
      if (p === paused) return;
      paused = p;
      // Resume without a catch-up burst for the time spent paused.
      acc = 0;
      last = null;
    },
    isPaused: () => paused,
    advance,
    stepManual(n) {
      for (let i = 0; i < n; i++) onStep();
    },
  };
}
