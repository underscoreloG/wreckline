import { createRenderer } from '../render';
import type { AudioEngine, CarId, HudState, InputFrame, InputSource, RaceSetup, RaceSnapshot, Renderer, Settings, Sim, SimEvent } from '../shared/contracts';
import { PLAYER_CAR_ID, SIM_HZ } from '../shared/contracts';
import { createSim } from '../sim';
import { createHudMemo, deriveHud } from './hud';

/** Results show this long after the sim phase turns 'finished' (WP08 table). */
export const RESULTS_DELAY_TICKS = Math.round(2.5 * SIM_HZ);
const HUD_EVERY_N_FRAMES = 4; // ~15 Hz at 60 fps

export interface RaceSessionOptions {
  canvas: HTMLCanvasElement;
  setup: RaceSetup;
  settings: Settings;
  input: InputSource;
  audio: AudioEngine;
  onHud(hud: HudState): void;
}

export interface RaceSession {
  readonly sim: Sim;
  readonly renderer: Renderer;
  readonly setup: RaceSetup;
  step(): void;
  render(alpha: number, dt: number): void;
  /** Redraws the current frame without advancing anything (resize while paused). */
  redraw(): void;
  /** Derives the HUD from every event since the last flush and publishes it. */
  flushHud(): void;
  /** True once the race has been finished for RESULTS_DELAY_TICKS. */
  isOver(): boolean;
  snapshot(): RaceSnapshot;
  /** Overrides fields of the player's input until cleared (null). */
  setOverride(patch: Partial<InputFrame> | null): void;
  dispose(): void;
}

/** One race: sim, renderer, player input, audio and HUD derivation, with the two event buffers. */
export async function createRaceSession(opts: RaceSessionOptions): Promise<RaceSession> {
  const { setup, input, audio } = opts;
  const sim = createSim(setup);
  let renderer: Renderer;
  try {
    renderer = await createRenderer({
      canvas: opts.canvas,
      track: sim.track,
      entrants: setup.entrants,
      playerCar: PLAYER_CAR_ID,
      quality: opts.settings.quality,
      cameraShake: opts.settings.cameraShake,
    });
  } catch (err) {
    sim.dispose();
    throw err;
  }
  renderer.resize(opts.canvas.clientWidth, opts.canvas.clientHeight, window.devicePixelRatio || 1);

  const playerIsAi = setup.entrants[PLAYER_CAR_ID]?.ai != null;
  const inputs = new Map<CarId, InputFrame>();
  const merged: InputFrame = { ...input.poll() };
  let override: Partial<InputFrame> | null = null;
  let prev = sim.snapshot();
  let curr = prev;
  const renderEvents: SimEvent[] = [];
  const hudEvents: SimEvent[] = [];
  const memo = createHudMemo();
  let hud: HudState | null = null;
  let frames = 0;
  let finishedTicks = 0;
  let disposed = false;

  const flushHud = (): void => {
    hud = deriveHud(curr, hudEvents, hud, setup, memo);
    hudEvents.length = 0;
    opts.onHud(hud);
  };

  const session: RaceSession = {
    sim,
    renderer,
    setup,
    step() {
      if (!playerIsAi) {
        Object.assign(merged, input.poll(), override);
        inputs.set(PLAYER_CAR_ID, merged);
      }
      for (const e of sim.step(inputs)) renderEvents.push(e);
      prev = curr;
      curr = sim.snapshot();
      if (curr.phase === 'finished') finishedTicks++;
    },
    render(alpha, dt) {
      renderer.render(prev, curr, alpha, renderEvents, dt);
      audio.update(curr, renderEvents, PLAYER_CAR_ID);
      for (const e of renderEvents) hudEvents.push(e);
      renderEvents.length = 0;
      if (++frames % HUD_EVERY_N_FRAMES === 0) flushHud();
    },
    redraw() {
      renderer.render(prev, curr, 1, [], 0);
    },
    flushHud,
    isOver: () => finishedTicks >= RESULTS_DELAY_TICKS,
    snapshot: () => curr,
    setOverride(patch) {
      override = patch;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.dispose();
      sim.dispose();
    },
  };
  flushHud();
  return session;
}
