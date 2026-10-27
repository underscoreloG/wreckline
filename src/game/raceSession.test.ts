import { afterAll, beforeAll, describe, expect, it, vi, type Mock } from 'vitest';
import { buildQuickRaceSetup } from '../content/quickRace';
import type { AudioEngine, InputFrame, InputSource, RaceSetup, Renderer, Settings } from '../shared/contracts';
import { NEUTRAL_INPUT, PLAYER_CAR_ID } from '../shared/contracts';
import { initPhysics } from '../sim';
import { createRaceSession, FAST_FORWARD_CAP_TICKS, PLAYER_DONE_DELAY_TICKS, type RaceSession } from './raceSession';

// The node test env has no WebGL: the renderer is a spy.
vi.mock('../render', () => ({
  createRenderer: async (): Promise<Renderer> => ({
    render: vi.fn(),
    resize: vi.fn(),
    setQuality: vi.fn(),
    setCameraShake: vi.fn(),
    setGhost: vi.fn(),
    stats: () => ({ drawCalls: 0, triangles: 0, fps: 0, geometries: 0, textures: 0 }),
    dispose: vi.fn(),
  }),
}));

const SETTINGS = { quality: 'high', cameraShake: true } as Settings;
const MAX_TICKS = 60 * 400;

const spyAudio = (): AudioEngine & { update: Mock<AudioEngine['update']>; stopRace: Mock<AudioEngine['stopRace']>; setRaceCars: Mock<AudioEngine['setRaceCars']> } => ({
  unlock: vi.fn(async () => {}),
  setVolumes: vi.fn(),
  setMusic: vi.fn(),
  update: vi.fn<AudioEngine['update']>(),
  setRaceCars: vi.fn<AudioEngine['setRaceCars']>(),
  stopRace: vi.fn<AudioEngine['stopRace']>(),
  ui: vi.fn(),
  dispose: vi.fn(),
});

const fixedInput = (frame: Readonly<InputFrame>): InputSource => ({
  poll: () => ({ ...frame }),
  onNav: () => () => {},
  usingGamepad: () => false,
  dispose: () => {},
});

const makeSession = (setup: RaceSetup, input: InputSource = fixedInput(NEUTRAL_INPUT), audio = spyAudio()): Promise<RaceSession> =>
  createRaceSession({ canvas: { clientWidth: 640, clientHeight: 360 } as HTMLCanvasElement, setup, settings: SETTINGS, input, audio, onHud: () => {} });

const playerDone = (s: RaceSession): boolean => {
  const p = s.snapshot().cars[PLAYER_CAR_ID]!;
  return p.finished || p.wrecked;
};

/** The game loop: step + render every tick until results are due. Returns the ticks from the player's finish/wreck to results. */
function runToResults(s: RaceSession): { doneTick: number; resultsTick: number } {
  let doneTick = -1;
  for (let i = 0; i < MAX_TICKS && !s.isOver(); i++) {
    s.step();
    s.render(1, 1 / 60);
    if (doneTick < 0 && playerDone(s)) doneTick = s.snapshot().tick;
  }
  expect(s.isOver()).toBe(true);
  return { doneTick, resultsTick: s.snapshot().tick };
}

/** The old behaviour: the player waits, stepping live until the race phase is 'finished'. */
function waitToEnd(s: RaceSession): void {
  for (let i = 0; i < MAX_TICKS && s.snapshot().phase !== 'finished'; i++) s.step();
  expect(s.snapshot().phase).toBe('finished');
}

beforeAll(async () => {
  // raceSession reads window.devicePixelRatio; Rapier's WASM reads window.performance when window exists.
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('devicePixelRatio', 1);
  await initPhysics();
});
afterAll(() => {
  vi.unstubAllGlobals();
});

describe('instant results (WP19)', () => {
  it('player finishes ahead of an AI: skip and wait give a deep-equal result, results 90 ticks after the finish, nothing rendered during the skip', async () => {
    const setup = buildQuickRaceSetup({ seed: 44, laps: 1, aiCount: 3, autoplay: true }); // WP37: 43 -> 44, the faster AIs all finished within 90 ticks of the player
    const audio = spyAudio();
    const a = await makeSession(setup, undefined, audio);
    const { doneTick, resultsTick } = runToResults(a);
    expect(a.snapshot().cars[PLAYER_CAR_ID]!.finished).toBe(true);
    expect(resultsTick - doneTick).toBe(PLAYER_DONE_DELAY_TICKS);
    expect(a.snapshot().phase).toBe('racing'); // at least one AI still racing: the skip has work to do

    const renders = vi.mocked(a.renderer.render).mock.calls.length;
    const updates = audio.update.mock.calls.length;
    const skipped = a.fastForward();
    expect(skipped).toBeGreaterThan(0);
    expect(vi.mocked(a.renderer.render).mock.calls.length).toBe(renders);
    expect(audio.update.mock.calls.length).toBe(updates);
    expect(audio.stopRace).toHaveBeenCalledTimes(1);
    const skipEnd = { tick: a.snapshot().tick, hash: a.sim.stateHash(), result: a.sim.result() };

    const b = await makeSession(setup);
    waitToEnd(b);
    expect(b.snapshot().tick).toBe(skipEnd.tick);
    expect(b.sim.stateHash()).toBe(skipEnd.hash);
    expect(b.sim.result()).not.toBeNull();
    expect(skipEnd.result).toEqual(b.sim.result());
    a.dispose();
    b.dispose();
  });

  it('human player wrecks: results 90 ticks after the wreck, same result as waiting with the throttle held', async () => {
    const base = buildQuickRaceSetup({ seed: 7, laps: 1, aiCount: 3 });
    const setup: RaceSetup = { ...base, entrants: base.entrants.map((e) => (e.id === PLAYER_CAR_ID ? { ...e, hp: 1 } : e)) };
    const floored = fixedInput({ ...NEUTRAL_INPUT, throttle: 1 });
    const a = await makeSession(setup, floored);
    const { doneTick, resultsTick } = runToResults(a);
    expect(a.snapshot().cars[PLAYER_CAR_ID]!.wrecked).toBe(true);
    expect(resultsTick - doneTick).toBe(PLAYER_DONE_DELAY_TICKS);
    a.fastForward();
    const b = await makeSession(setup, floored);
    waitToEnd(b);
    expect(b.snapshot().tick).toBe(a.snapshot().tick);
    expect(a.sim.result()).toEqual(b.sim.result());
    a.dispose();
    b.dispose();
  });

  it('the fast-forward cap is never reached on 16 seeds', async () => {
    const error = vi.spyOn(console, 'error');
    for (let seed = 1; seed <= 16; seed++) {
      const s = await makeSession(buildQuickRaceSetup({ seed, laps: 3, aiCount: 3, autoplay: true }));
      runToResults(s);
      const n = s.fastForward();
      // 15 s after the player's finish at most, of which 1.5 s were shown live.
      expect(n).toBeLessThanOrEqual(900 - PLAYER_DONE_DELAY_TICKS);
      expect(n).toBeLessThan(FAST_FORWARD_CAP_TICKS);
      expect(s.sim.result()).not.toBeNull();
      s.dispose();
    }
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('engine voices (CCR-9)', () => {
  it('passes every entrant car and its effective maxSpeed to the audio before the first update', async () => {
    const setup = buildQuickRaceSetup({ seed: 5, laps: 1, aiCount: 3 });
    const audio = spyAudio();
    const s = await makeSession(setup, undefined, audio);
    expect(audio.setRaceCars).toHaveBeenCalledWith(setup.entrants.map((e) => ({ carDefId: e.carDefId, maxSpeed: e.stats.maxSpeed })));
    expect(audio.update).not.toHaveBeenCalled();
    s.dispose();
  });
});
