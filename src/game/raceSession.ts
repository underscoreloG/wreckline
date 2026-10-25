import { createRenderer } from '../render';
import type { AudioEngine, CarId, HudState, InputFrame, InputSource, RaceSetup, RaceSnapshot, Renderer, Settings, Sim, SimEvent } from '../shared/contracts';
import { NEUTRAL_INPUT, PLAYER_CAR_ID, SIM_HZ } from '../shared/contracts';
import { createSim } from '../sim';
import { createTally, tallyEvent, type RaceTally } from './careerSession';
import { createHudMemo, deriveHud } from './hud';

/** The live race stays on screen this long after the player finishes or wrecks, then results (WP19). */
export const PLAYER_DONE_DELAY_TICKS = Math.round(1.5 * SIM_HZ);
/** Fast-forward safety cap: the race-end rules end the race within 900 ticks of the player's finish. */
export const FAST_FORWARD_CAP_TICKS = 3600;
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
  /** True once the player (or the race) has been done for PLAYER_DONE_DELAY_TICKS. */
  isOver(): boolean;
  /**
   * Steps the sim headlessly (no render, audio or HUD, neutral player input) until the race phase is
   * 'finished'. Same seed and inputs give the same result as waiting. Returns the ticks stepped.
   */
  fastForward(): number;
  snapshot(): RaceSnapshot;
  /** Wreck credits and cash pickups so far (a quit career race has no sim result to read them from). */
  readonly tally: RaceTally;
  /** Overrides fields of the player's input until cleared (null). */
  setOverride(patch: Partial<InputFrame> | null): void;
  dispose(): void;
}

/** One race: sim, renderer, player input, audio and HUD derivation, with the two event buffers. */
export async function createRaceSession(opts: RaceSessionOptions): Promise<RaceSession> {
  const { setup, input, audio } = opts;
  const sim = createSim(setup);
  audio.setRaceCars(setup.entrants.map((e) => ({ carDefId: e.carDefId, maxSpeed: e.stats.maxSpeed })));
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
  let doneTick: number | null = null;
  let disposed = false;
  const tally = createTally(setup.entrants.length);

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
      for (const e of sim.step(inputs)) {
        renderEvents.push(e);
        tallyEvent(tally, e);
      }
      prev = curr;
      curr = sim.snapshot();
      const p = curr.cars[PLAYER_CAR_ID];
      if (doneTick === null && (curr.phase === 'finished' || p?.finished || p?.wrecked)) doneTick = curr.tick;
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
    isOver: () => doneTick !== null && curr.tick - doneTick >= PLAYER_DONE_DELAY_TICKS,
    fastForward() {
      audio.stopRace();
      if (!playerIsAi) {
        Object.assign(merged, NEUTRAL_INPUT);
        inputs.set(PLAYER_CAR_ID, merged);
      }
      let n = 0;
      while (sim.snapshot().phase !== 'finished') {
        if (n >= FAST_FORWARD_CAP_TICKS) {
          console.error(`[game] fast-forward: race not finished after ${n} ticks`);
          break;
        }
        // Skipped ticks never reach the renderer, audio or HUD; the tally still counts them.
        for (const e of sim.step(inputs)) tallyEvent(tally, e);
        n++;
      }
      prev = curr = sim.snapshot();
      return n;
    },
    snapshot: () => curr,
    tally,
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
