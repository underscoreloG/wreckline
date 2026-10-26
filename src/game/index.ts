import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createAudioEngine } from '../audio';
import { carOrStarter, getCar } from '../content/cars';
import { QUICK_RACE_CASH_VALUE } from '../content/economy';
import { buildQuickRaceSetup } from '../content/quickRace';
import { TRACKS } from '../content/tracks';
import { createInputSource } from '../input';
import type { KeyValueStore } from '../meta/save';
import type { GameCommand, GameStore, InputFrame, RaceResult, RaceSetup, Renderer, UiState, Vec2 } from '../shared/contracts';
import { buildTrackGeometry } from '../shared/trackGeometry';
import { initPhysics } from '../sim';
import { App } from '../ui/App';
import { TOAST_SHOW_MS } from '../ui/screens/career/Toast';
import { beatenText, createCareerSession, dnfResult, unlockText } from './careerSession';
import { installDebug } from './debug';
import { createLoop } from './loop';
import { transition, type Effect, type MachineInput } from './machine';
import { createRaceSession, type RaceSession } from './raceSession';
import { loadSettings, quickTrackOrFirst, saveSettings, type SettingsStorage } from './settings';
import { createGameStore } from './store';
import { createTitleBackdrop, type TitleBackdrop } from './titleBackdrop';

export interface GameHandle {
  store: GameStore;
  dispose(): void;
}

const QUICK_LAPS = 3;
const QUICK_AI = 3;
const MINIMAP_STEP = 8; // m between minimap points
const DEBUG_RENDER_EVERY = 60; // manual steps per rendered frame in __game.step
const DEBUG_RENDER_DT = 0.1; // s, same cap as the live loop
const POLL_MS = 250; // fps overlay and gamepad glyph refresh

const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;

function safeStorage(): SettingsStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The career save goes through the meta storage adapter (meta never touches the global itself). */
function careerStorage(): KeyValueStore {
  let ls: Storage | null = null;
  try {
    ls = window.localStorage;
  } catch {
    ls = null;
  }
  return {
    get: (k) => ls?.getItem(k) ?? null,
    set: (k, v) => {
      if (!ls) throw new Error('localStorage unavailable');
      ls.setItem(k, v);
    },
    remove: (k) => ls?.removeItem(k),
  };
}

const intParam = (params: URLSearchParams, key: string): number | undefined => {
  const v = params.get(key);
  const n = v === null ? NaN : Number(v);
  return Number.isInteger(n) ? n : undefined;
};

function raceInfo(setup: RaceSetup): NonNullable<UiState['race']> {
  const geo = buildTrackGeometry(setup.track);
  const every = Math.max(1, Math.round(MINIMAP_STEP / (geo.length / geo.samples.length)));
  const minimapPath: Vec2[] = geo.samples.filter((_, i) => i % every === 0).map((s) => ({ x: s.pos.x, y: s.pos.y }));
  return {
    trackId: setup.track.id,
    trackName: setup.track.name,
    laps: setup.laps,
    entrants: setup.entrants.map((e) => ({ id: e.id, name: e.name, color: e.color, carName: getCar(e.carDefId).name })),
    minimapPath,
  };
}

/** Quick race shows cash pickups as units x QUICK_RACE_CASH_VALUE. */
const quickRaceResult = (r: RaceResult): RaceResult => ({ ...r, rows: r.rows.map((row) => ({ ...row, cashPicked: row.cashPicked * QUICK_RACE_CASH_VALUE })) });

export async function startGame(root: HTMLElement): Promise<GameHandle> {
  const params = new URLSearchParams(window.location.search);
  const autoplay = params.get('autoplay') === '1';
  const autoPauseOff = params.get('autopause') === '0';
  const fpsParam = params.get('fps') === '1';

  let canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block';
    document.body.prepend(canvas);
  }
  const cv = canvas;

  const storage = safeStorage();
  const input = createInputSource(window);
  const audio = createAudioEngine();
  const career = createCareerSession(careerStorage(), (text) => toast(text, 'info')); // CCR-4: tow toast; toast is defined below and only called from command handlers
  const initial: UiState = {
    screen: 'boot',
    previousScreen: null,
    settings: loadSettings(storage),
    usingGamepad: false,
    version: __APP_VERSION__,
    race: null,
    hud: null,
    results: null,
    save: career.save,
    offers: null,
    selectedOffer: null,
    lastPayout: null,
    toast: null,
  };
  audio.setVolumes(initial.settings.masterVolume, initial.settings.sfxVolume);

  let setup: RaceSetup | null = null;
  let session: RaceSession | null = null;
  let backdrop: TitleBackdrop | null = null;
  let sessionGen = 0;
  let backdropGen = 0;
  let override: Partial<InputFrame> | null = null;
  let debugDriven = false;
  let mode: 'quick' | 'career' = 'quick';
  let justChampion = false;
  let unlocked: string[] = []; // tracks the last career race unlocked, announced on the hub
  let beaten: string[] = []; // car types the last career race beat for the first time, announced on the hub (CCR-10)
  const queued: number[] = []; // timers of info toasts waiting their turn
  let toastId = 0;

  const toast = (text: string, kind: NonNullable<UiState['toast']>['kind']): void => store.set({ toast: { id: ++toastId, text, kind } });
  /** One info toast after another, each shown for its full time (the UI shows a single toast). */
  const toastQueue = (texts: readonly string[]): void => {
    texts.forEach((text, i) => {
      if (i === 0) toast(text, 'info');
      else queued.push(window.setTimeout(() => toast(text, 'info'), i * TOAST_SHOW_MS));
    });
  };
  const fail = (text: string): void => {
    audio.ui('error');
    toast(text, 'error');
  };
  /** Publishes the career save and offers, and reports a refused write. */
  const publishCareer = (): void => {
    store.set({ save: career.save, offers: career.offers });
    if (!career.lastWriteOk) toast('Could not save: browser storage is full or blocked', 'error');
  };

  const onCommand = (cmd: GameCommand): void => {
    const screen = store.getState().screen;
    switch (cmd.type) {
      case 'setSetting':
        applySettings(cmd.patch);
        // Quick race CAR picker (CCR-10): rebuild the shown setup with the picked car.
        if (cmd.patch.quickCarId !== undefined && mode === 'quick' && screen === 'preRace' && setup) {
          setup = quickSetup(setup.seed);
          store.set({ race: raceInfo(setup) });
        }
        return;
      case 'newCareer':
        if (screen !== 'title' && screen !== 'champion') return;
        career.newCareer(randomSeed());
        mode = 'career';
        publishCareer();
        break;
      case 'continueCareer':
        if (screen !== 'title') return;
        if (!career.continueCareer()) return fail('No saved career found');
        mode = 'career';
        publishCareer();
        break;
      case 'navigate':
        if (screen === 'career' && cmd.screen === 'raceSelect') {
          career.ensureOffers();
          publishCareer();
        }
        break;
      case 'selectOffer': {
        if (screen !== 'raceSelect') return;
        const r = career.selectOffer(cmd.offerId, randomSeed());
        if (!r.ok) return fail(r.error);
        setup = r.setup;
        store.set({ race: raceInfo(setup), hud: null, results: null, selectedOffer: cmd.offerId, lastPayout: null });
        break;
      }
      case 'buySabotage': {
        const offerId = store.getState().selectedOffer;
        if (mode !== 'career' || screen !== 'preRace' || !offerId || !setup) return;
        const r = career.buySabotage();
        if (!r.ok) return fail(r.error);
        audio.ui('buy');
        // The setup was built at selectOffer, before the purchase: rebuild it (same seed) so the target starts damaged.
        const s = career.selectOffer(offerId, setup.seed);
        if (s.ok) setup = s.setup;
        publishCareer();
        if (career.lastWriteOk) toast(`Sabotaged: ${r.target} -${r.pct}%`, 'info');
        return;
      }
      case 'setQuickTrack': {
        if (mode !== 'quick' || screen !== 'preRace' || !TRACKS[cmd.trackId] || !setup) return;
        applySettings({ quickTrackId: cmd.trackId });
        setup = quickSetup(setup.seed);
        store.set({ race: raceInfo(setup) });
        return;
      }
      case 'buyUpgrade':
      case 'buyCar':
      case 'repair':
      case 'buyMines':
      case 'buyTurbo': {
        if (mode !== 'career' || (screen !== 'shop' && screen !== 'garage')) return;
        const r = career.shop(cmd);
        if (!r.ok) return fail(r.error);
        audio.ui('buy');
        publishCareer();
        return;
      }
      case 'restartRace':
        if (mode === 'career' && (screen === 'paused' || screen === 'results')) return fail('No restarts in career');
        break;
      case 'quitRace':
        if (mode === 'career' && screen === 'paused' && session) {
          const r = career.finishRace(dnfResult(session.setup, session.snapshot(), session.tally, session.sim.result()));
          publishCareer();
          store.set({ selectedOffer: null, lastPayout: null });
          const dnf = r.payout.total > 0 ? `DNF - earned $${r.payout.total}` : 'DNF';
          toastQueue([r.unlocked.length ? `${dnf} · ${unlockText(r.unlocked)}` : dnf, ...r.beaten.map(beatenText)]);
        }
        break;
      case 'continueFromResults':
        run(cmd);
        justChampion = false;
        if (mode === 'career') store.set({ offers: career.offers, selectedOffer: null, lastPayout: null });
        // Shown once, on the hub (the champion screen skips it: the career is over).
        if (store.getState().screen === 'career') toastQueue([...(unlocked.length ? [unlockText(unlocked)] : []), ...beaten.map(beatenText)]);
        unlocked = [];
        beaten = [];
        return;
      case 'startQuickRace':
        mode = 'quick';
        break;
    }
    run(cmd);
  };
  const store = createGameStore(initial, onCommand);

  const activeRenderer = (): Renderer | null => session?.renderer ?? backdrop?.renderer ?? null;

  const applySettings = (patch: Partial<Omit<UiState['settings'], 'version'>>): void => {
    const s = { ...store.getState().settings, ...patch };
    store.set({ settings: s });
    saveSettings(storage, s);
    audio.setVolumes(s.masterVolume, s.sfxVolume);
    backdrop?.renderer.setQuality(s.quality);
    session?.renderer.setQuality(s.quality);
    session?.renderer.setCameraShake(s.cameraShake);
    if (loop.isPaused()) session?.redraw();
  };

  const quickSetup = (seed: number): RaceSetup =>
    buildQuickRaceSetup({
      seed,
      laps: QUICK_LAPS,
      aiCount: QUICK_AI,
      autoplay,
      trackId: quickTrackOrFirst(store.getState().settings.quickTrackId, Object.keys(TRACKS)),
      carId: carOrStarter(store.getState().settings.quickCarId).id,
    });

  const startBackdrop = async (): Promise<void> => {
    const g = ++backdropGen;
    const b = await createTitleBackdrop(cv, store.getState().settings.quality);
    if (g !== backdropGen) b.dispose();
    else backdrop = b;
  };
  const stopBackdrop = (): void => {
    backdropGen++;
    backdrop?.dispose();
    backdrop = null;
  };

  const startSession = async (s: RaceSetup): Promise<void> => {
    const g = ++sessionGen;
    store.set({ hud: null, results: null });
    const created = await createRaceSession({
      canvas: cv,
      setup: s,
      settings: store.getState().settings,
      input,
      audio,
      onHud: (hud) => {
        if (g === sessionGen) store.set({ hud });
      },
    });
    if (g !== sessionGen) {
      created.dispose();
      return;
    }
    created.setOverride(override);
    session = created;
  };
  const disposeSession = (): void => {
    sessionGen++;
    session?.dispose();
    session = null;
    store.set({ hud: null });
    audio.stopRace();
    loop.setPaused(false);
  };

  const report = (err: unknown): void => console.error('[game]', err);

  const apply = (e: Effect): void => {
    switch (e) {
      case 'startBackdrop':
        startBackdrop().catch(report);
        break;
      case 'stopBackdrop':
        stopBackdrop();
        break;
      case 'buildSetup':
        setup = quickSetup(randomSeed());
        store.set({ race: raceInfo(setup), hud: null, results: null, lastPayout: null, selectedOffer: null });
        break;
      case 'startSession':
        if (setup) startSession(setup).catch(report);
        break;
      case 'restartSession':
        if (!setup) break;
        disposeSession();
        setup = { ...setup, seed: randomSeed() };
        startSession(setup).catch(report);
        break;
      case 'disposeSession':
        disposeSession();
        break;
      case 'pauseLoop':
        loop.setPaused(true);
        audio.stopRace();
        break;
      case 'resumeLoop':
        loop.setPaused(false);
        break;
      case 'unlockAudio':
        audio.unlock().catch(report);
        break;
      case 'showResults': {
        session?.fastForward();
        const r = session?.sim.result() ?? null;
        if (mode === 'career' && r) {
          const { payout, champion, unlocked: ids, beaten: cars } = career.finishRace(r);
          justChampion = champion;
          unlocked = ids;
          beaten = cars;
          // Offers stay in the UI state until CONTINUE: the results PRIZE column reads the selected offer.
          store.set({ results: r, lastPayout: payout, save: career.save });
          if (!career.lastWriteOk) toast('Could not save: browser storage is full or blocked', 'error');
        } else store.set({ results: r && quickRaceResult(r) });
        break;
      }
    }
  };

  const run = (mi: MachineInput): void => {
    const t = transition({ ...store.getState(), career: mode === 'career', champion: justChampion }, mi);
    if (!t) return;
    store.set({ screen: t.screen, previousScreen: t.previousScreen });
    for (const e of t.effects) apply(e);
  };

  const onStep = (): void => {
    if (session) {
      session.step();
      if (session.isOver() && store.getState().screen === 'race') run({ type: 'raceOver' });
    } else backdrop?.step();
  };
  const onRender = (alpha: number, dt: number): void => {
    if (session) session.render(alpha, dt);
    else backdrop?.render(alpha, dt);
  };
  const loop = createLoop(onStep, onRender);

  // UI: the game owns input and audio (SPEC.md rule 5), so it mounts App itself.
  const reactRoot = createRoot(root);
  reactRoot.render(createElement(App, { store, nav: input.onNav, onUiSound: (s) => audio.ui(s) }));

  // Audio may only start from a gesture; any key or click unlocks it (title UI sounds, ?race=1).
  const unlock = (): void => {
    audio.unlock().catch(report);
  };
  const onResize = (): void => {
    activeRenderer()?.resize(cv.clientWidth, cv.clientHeight, window.devicePixelRatio || 1);
    if (loop.isPaused()) session?.redraw();
  };
  const autoPause = (): void => {
    if (autoPauseOff || debugDriven) return;
    if (store.getState().screen === 'race') run({ type: 'pause' });
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') autoPause();
  };
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('resize', onResize);
  window.addEventListener('blur', autoPause);
  document.addEventListener('visibilitychange', onVisibility);

  const fpsEl = document.createElement('div');
  fpsEl.style.cssText =
    'position:fixed;top:8px;left:50%;transform:translateX(-50%);padding:2px 8px;border-radius:4px;background:rgba(11,13,16,0.7);color:#E8EAED;font:12px/1.4 ui-monospace,monospace;pointer-events:none;z-index:20;display:none';
  document.body.append(fpsEl);
  const poll = window.setInterval(() => {
    const pad = input.usingGamepad();
    if (pad !== store.getState().usingGamepad) store.set({ usingGamepad: pad });
    const r = activeRenderer();
    const show = (fpsParam || store.getState().settings.showFps) && r !== null;
    fpsEl.style.display = show ? 'block' : 'none';
    if (show && r) {
      const st = r.stats();
      fpsEl.textContent = `${st.fps.toFixed(0)} fps  ${st.drawCalls} draws  ${Math.round(st.triangles / 1000)}k tris`;
    }
  }, POLL_MS);

  const debugStep = (n: number): void => {
    debugDriven = true;
    for (let i = 1; i <= n; i++) {
      // Behind the results screen the session is frozen, as in the live loop (paused there).
      if (store.getState().screen === 'results') break;
      onStep();
      if (i % DEBUG_RENDER_EVERY === 0 || i === n) onRender(1, DEBUG_RENDER_DT);
    }
    session?.flushHud();
  };
  const uninstallDebug = installDebug({
    store,
    session: () => (session ? { sim: session.sim, renderer: session.renderer, setup: session.setup } : null),
    step: debugStep,
    snapshot: () => session?.snapshot() ?? null,
    setInput(patch) {
      debugDriven = true;
      override = { ...override, ...patch };
      session?.setOverride(override);
    },
    clearInput() {
      override = null;
      session?.setOverride(null);
    },
    finishRaceNow() {
      session?.sim.debugFinishRace();
      debugStep(1);
    },
  });

  loop.start();
  await Promise.all([initPhysics(), document.fonts.ready]);

  if (params.get('race') === '1') {
    setup = buildQuickRaceSetup({
      seed: intParam(params, 'seed') ?? randomSeed(),
      laps: Math.min(9, Math.max(1, intParam(params, 'laps') ?? QUICK_LAPS)),
      aiCount: Math.min(7, Math.max(1, intParam(params, 'ai') ?? QUICK_AI)),
      trackId: params.get('track') ?? undefined,
      autoplay,
    });
    store.set({ screen: 'race', previousScreen: null, race: raceInfo(setup) });
    await startSession(setup);
  } else {
    run({ type: 'booted' });
  }

  return {
    store,
    dispose() {
      loop.stop();
      queued.forEach((t) => window.clearTimeout(t));
      window.clearInterval(poll);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('blur', autoPause);
      document.removeEventListener('visibilitychange', onVisibility);
      uninstallDebug();
      stopBackdrop();
      disposeSession();
      reactRoot.unmount();
      fpsEl.remove();
      input.dispose();
      audio.dispose();
    },
  };
}
