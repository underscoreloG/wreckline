import { buildQuickRaceSetup } from '../content/quickRace';
import { createRenderer } from '../render';
import type { Quality, RaceSnapshot, Renderer, SimEvent } from '../shared/contracts';
import { createFakeSim } from '../sim';

const BACKDROP_SEED = 7;
const BACKDROP_LAPS = 9; // the longest race a setup allows, then it starts over

export interface TitleBackdrop {
  readonly renderer: Renderer;
  step(): void;
  render(alpha: number, dt: number): void;
  redraw(): void;
  dispose(): void;
}

/** Title screen background: the renderer on the fake sim, camera following car 0, no shake. */
export async function createTitleBackdrop(canvas: HTMLCanvasElement, quality: Quality): Promise<TitleBackdrop> {
  const setup = buildQuickRaceSetup({ seed: BACKDROP_SEED, laps: BACKDROP_LAPS });
  let sim = createFakeSim(setup);
  const renderer = await createRenderer({ canvas, track: sim.track, entrants: setup.entrants, playerCar: 0, quality, cameraShake: false });
  renderer.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
  const empty = new Map();
  const events: SimEvent[] = [];
  let prev: RaceSnapshot = sim.snapshot();
  let curr = prev;

  return {
    renderer,
    step() {
      if (curr.phase === 'finished') {
        sim.dispose();
        sim = createFakeSim(setup);
        curr = sim.snapshot();
      }
      for (const e of sim.step(empty)) events.push(e);
      prev = curr;
      curr = sim.snapshot();
    },
    render(alpha, dt) {
      renderer.render(prev, curr, alpha, events, dt);
      events.length = 0;
    },
    redraw() {
      renderer.render(prev, curr, 1, [], 0);
    },
    dispose() {
      renderer.dispose();
      sim.dispose();
    },
  };
}
