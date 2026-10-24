import { buildQuickRaceSetup } from '../content/quickRace';
import { createInputSource } from '../input';
import type { Sim } from '../shared/contracts';
import { createFakeSim, createSim, initPhysics } from '../sim';
import { mountDebug2d } from './debug2d';

/** ?harness=debug2d[&fake=1]: reads seed, laps, ai (AI opponents), autoplay, track, autopause. */
export async function mountDebug2dHarness(root: HTMLElement, params: URLSearchParams): Promise<void> {
  const num = (key: string, fallback: number): number => {
    const raw = params.get(key);
    const v = raw === null ? NaN : Number(raw);
    return Number.isFinite(v) ? v : fallback;
  };
  const setup = buildQuickRaceSetup({
    seed: num('seed', 1),
    laps: num('laps', 3),
    aiCount: num('ai', 3),
    trackId: params.get('track') ?? undefined,
    autoplay: params.get('autoplay') === '1',
  });
  let sim: Sim;
  if (params.get('fake') === '1') {
    sim = createFakeSim(setup);
  } else {
    await initPhysics();
    sim = createSim(setup);
  }
  mountDebug2d(root, sim, createInputSource(window), { autopause: params.get('autopause') !== '0' });
}
