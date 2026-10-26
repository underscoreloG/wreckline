/**
 * Wreckline - shared contracts (FROZEN after WP00).
 *
 * WP00 copies this file verbatim to src/shared/contracts.ts. No other work package
 * edits it. A WP that needs a change stops and files a Contract Change Request
 * (see SPEC.md section 9).
 *
 * Conventions (apply everywhere):
 * - Units: meters, seconds, radians, kilograms. Speeds in m/s (HUD converts to km/h).
 * - Sim plane is screen-like: +x = right (east), +y = DOWN (south) on screen.
 * - heading: radians, 0 = facing +x. Increasing heading turns the car CLOCKWISE on screen.
 * - forward(h) = (cos h, sin h); right(h) = (-sin h, cos h) = the car's right-hand side on screen.
 * - steer = +1 means "turn right" (clockwise on screen, heading increases).
 * - Render mapping: sim (x, y) -> three.js world (x, 0, y); mesh.rotation.y = -heading;
 *   car meshes are modeled facing +x.
 * - Lateral offsets on the track: positive = right of the direction of travel.
 */

// ---------------------------------------------------------------- basics

export interface Vec2 {
  x: number;
  y: number;
}

export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;

export type CarId = number; // 0..N-1, index into RaceSetup.entrants. Player is always 0.
export const PLAYER_CAR_ID: CarId = 0;

// ---------------------------------------------------------------- input

export interface InputFrame {
  throttle: number; // 0..1
  brake: number; // 0..1; also reverses when nearly stopped
  steer: number; // -1..1, +1 = right
  handbrake: boolean;
  fire: boolean; // machine gun, held
  dropMine: boolean; // edge-triggered inside the sim (fires on false -> true)
  turbo: boolean; // held
}

export const NEUTRAL_INPUT: Readonly<InputFrame> = {
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false,
  fire: false,
  dropMine: false,
  turbo: false,
};

// ---------------------------------------------------------------- content

export interface CarStats {
  maxSpeed: number; // m/s
  accel: number; // m/s^2
  brake: number; // m/s^2
  turnRate: number; // rad/s at low speed
  grip: number; // 0..1, lateral grip factor
  mass: number; // kg
  maxHp: number;
  gunDps: number; // hp per second while the gun hits
  // Rocket fuel and bumper spikes (CCR-5, 2026-10-25; base values in content.md section 1, upgrades in section 2)
  turboSpeedMult: number; // maxSpeed multiplier while rocket fuel burns (base 1.30)
  turboAccelMult: number; // accel multiplier while rocket fuel burns (base 1.60)
  ramDealtMult: number; // multiplier on collision damage this car deals with its front (base 1)
  ramTakenMult: number; // multiplier on collision damage this car takes when hitting with its front (base 1)
}

export type CarMeshStyle = 'compact' | 'muscle' | 'wedge' | 'boss' | 'buggy' | 'wagon' | 'truck'; // procedural silhouettes; 'compact' is used by the wreck prop

/** Procedural mesh parameters, read only by the renderer and the garage preview. */
export interface CarMeshSpec {
  style: CarMeshStyle;
  length: number; // m, also the collider length
  width: number; // m, also the collider width
  height: number; // m, body height without cabin
  cabinLength: number; // fraction of length 0..1
  cabinOffset: number; // fraction of length, + toward the front
  spoiler: boolean;
  wheelRadius: number; // m
  spikes: number; // 0..3 bumper spike level, visual only (CCR-5)
  /** glTF path relative to the site root (e.g. 'models/cars/raven.glb'), null = procedural mesh from the fields above. Set by WP14 after the fun gate. The fields above still give the collider and the model's target size. */
  model: string | null;
}

export interface CarDef {
  id: string;
  name: string;
  forSale: boolean; // listed in the shop from the start (scorch, titan, viper); other cars except the starter are listed once beaten (CCR-10)
  price: number; // list price; trade-in base for every car
  tier: 1 | 2 | 3; // upgrade cost multiplier index, see content.md
  base: CarStats;
  mesh: CarMeshSpec;
}

export type UpgradeKind = 'engine' | 'tires' | 'armor' | 'gun' | 'fuel' | 'spikes';
export type UpgradeLevels = Record<UpgradeKind, number>; // 0..5 each, except spikes 0..3 (MAX_LEVEL per kind in content)

export type PickupKind = 'cash' | 'repair' | 'mines' | 'turbo';

export interface PickupSpawn {
  kind: PickupKind;
  s: number; // meters along centerline from the start line
  lateral: number; // meters, + = right of travel direction; |lateral| <= width/2 - 1.5
}

export type PropKind =
  | 'crate'
  | 'tireStack'
  | 'barrel'
  | 'container'
  | 'wreck'
  | 'lightPole'
  | 'cone'
  | 'rock'
  | 'cactus'
  | 'building'
  // CCR-6 (2026-10-25): props for the snow, city and quarry themes
  | 'pine'
  | 'snowbank'
  | 'billboard'
  | 'crane';

export interface PropPlacement {
  kind: PropKind;
  pos: Vec2;
  rotation: number; // radians, same convention as heading
  scale: number; // 1 = default size
}

export type TrackTheme = 'scrapyard' | 'desert' | 'docks' | 'snow' | 'city' | 'quarry'; // CCR-6 adds the last three

export interface TrackDef {
  id: string;
  name: string;
  theme: TrackTheme;
  /** Closed loop, listed in race direction, first point = start/finish line. Centripetal Catmull-Rom. */
  centerline: Vec2[];
  width: number; // road width in m (asphalt)
  shoulder: number; // m of dirt on each side between road edge and wall
  checkpointSpacing: number; // target meters between checkpoints (actual = length / round(length / spacing))
  pickups: PickupSpawn[];
  props: PropPlacement[]; // decoration, must be outside walls; static colliders only for 'container' | 'building' | 'rock' | 'crane' | 'billboard' (CCR-6: posts and base only)
  referenceLapTime: number; // seconds, a clean medium-AI lap; used by tests and results
}

// ---------------------------------------------------------------- track geometry (src/shared/trackGeometry.ts)

export interface TrackSample {
  s: number; // meters from start line
  pos: Vec2;
  tangent: Vec2; // unit, direction of travel
  right: Vec2; // unit, = (-tangent.y, tangent.x)
  curvature: number; // 1/m, signed: + = turning right
}

export interface Checkpoint {
  index: number; // 0 = start/finish line
  s: number;
  a: Vec2; // left wall end of the gate
  b: Vec2; // right wall end of the gate
}

export interface GridSlot {
  pos: Vec2;
  heading: number;
}

export interface TrackProjection {
  s: number;
  lateral: number; // signed distance from centerline, + = right
  sample: TrackSample;
}

export interface TrackGeometry {
  def: TrackDef;
  length: number;
  /** Uniform samples every ~1 m (exactly length / samples.length apart). */
  samples: TrackSample[];
  leftEdge: Vec2[]; // road edge polylines, same count as samples
  rightEdge: Vec2[];
  leftWall: Vec2[]; // road edge + shoulder
  rightWall: Vec2[];
  checkpoints: Checkpoint[];
  grid: GridSlot[]; // 8 slots behind the start line, 2 columns, staggered
  sampleAt(s: number): TrackSample; // s wraps modulo length, linear interpolation. Allocates: setup and tests only
  /** Allocation-free sampleAt: writes into `out` (and its pos/tangent/right objects) and returns it. Use in per-tick sim and AI code. */
  sampleAtInto(out: TrackSample, s: number): TrackSample;
  /** Nearest point on centerline. hintS narrows the search to +-40 m. Allocates: setup and tests only. */
  project(p: Vec2, hintS?: number): TrackProjection;
  /** Allocation-free project: writes into `out` (out.sample is overwritten in place, never replaced) and returns it. Use every tick. */
  projectInto(out: TrackProjection, p: Vec2, hintS?: number): TrackProjection;
}

export interface TrackValidation {
  ok: boolean;
  errors: string[]; // human readable, empty when ok
  length: number;
  minRadius: number;
  minClearance: number;
}

// ---------------------------------------------------------------- AI

export interface AiProfile {
  skill: number; // 0..1.1 (1.1 = boss); derived values below come from content.md table
  cornerSpeedFactor: number; // fraction of the grip-limited corner speed it dares to carry
  lineNoise: number; // m, lateral wobble amplitude around the racing line
  reactionTicks: number; // input delay
  aggression: number; // 0..1, chance per second to start firing when a target is valid
  mineUse: number; // 0..1, chance to drop a mine when a car is in the rear cone
  turboUse: number; // 0..1, chance to use turbo on a qualifying straight
  rubberBand: number; // 0..0.1, max +-fraction of maxSpeed adjusted by distance to the player
}

// ---------------------------------------------------------------- race setup and results

export interface EntrantSetup {
  id: CarId;
  driverId: string; // stable rival id, 'player' for the human
  name: string;
  color: string; // livery hex '#rrggbb'
  carDefId: string;
  stats: CarStats; // effective stats after upgrades, computed by meta (M2) or content defaults (M1)
  mesh: CarMeshSpec;
  hp: number; // start hp (damage carries over in career), 0 < hp <= stats.maxHp
  mines: number; // carried mines
  turbo: number; // seconds of turbo
  ai: AiProfile | null; // null = controlled by InputFrame from outside
}

export interface RaceSetup {
  seed: number; // uint32
  track: TrackDef;
  laps: number; // 1..9
  entrants: EntrantSetup[]; // 2..8, entrants[i].id === i, entrants[0] is the player
  countdownSeconds: number; // 3
}

export interface RaceResultRow {
  car: CarId;
  driverId: string;
  name: string;
  position: number; // 1-based, final
  finished: boolean; // false = DNF (wrecked) or still running when the race ended
  wrecked: boolean;
  totalTime: number | null; // seconds from green to finish line
  bestLap: number | null;
  wrecksCaused: number; // cars this car wrecked (last damage source)
  cashPicked: number; // sum of cash pickups (raw, tier scaling applied by meta)
  hpLeft: number;
  minesLeft: number;
  turboLeft: number;
}

export interface RaceResult {
  trackId: string;
  laps: number;
  rows: RaceResultRow[]; // sorted by position
}

// ---------------------------------------------------------------- sim snapshot

export type RacePhase = 'countdown' | 'racing' | 'finished';

export interface CarState {
  id: CarId;
  pos: Vec2;
  heading: number;
  vel: Vec2;
  angVel: number;
  speed: number; // signed forward speed, m/s
  hp: number;
  maxHp: number;
  mines: number;
  turbo: number; // seconds left
  turboActive: boolean;
  gunHeat: number; // 0..1
  gunOverheated: boolean;
  firing: boolean;
  braking: boolean; // brake input > 0.1 while moving forward (tail lights)
  drifting: boolean; // |lateral speed| > 3.5 m/s
  offroad: boolean;
  wrecked: boolean;
  lap: number; // completed laps
  nextCheckpoint: number;
  progress: number; // lap * track.length + s, monotonic while driving the right way
  position: number; // 1-based live position
  finished: boolean;
  finishTime: number | null;
  lastLapTime: number | null;
  bestLapTime: number | null;
  currentLapStart: number; // race time when the current lap started
  wrongWay: boolean;
}

export interface MineState {
  id: number;
  owner: CarId;
  pos: Vec2;
  armed: boolean;
}

export interface PickupState {
  id: number; // index into track.pickups
  kind: PickupKind;
  pos: Vec2;
  active: boolean; // false while waiting to respawn
}

export interface RaceSnapshot {
  tick: number;
  time: number; // seconds since green light, 0 during countdown
  phase: RacePhase;
  countdown: number; // seconds left in countdown, 0 once racing
  laps: number;
  cars: CarState[]; // index === CarId
  mines: MineState[];
  pickups: PickupState[];
}

// ---------------------------------------------------------------- sim events

export type DamageSource = 'gun' | 'mine' | 'collision' | 'wall';

export type SimEvent =
  | { type: 'countdown'; value: 3 | 2 | 1 }
  | { type: 'raceStart' }
  | { type: 'lapCompleted'; car: CarId; lap: number; lapTime: number }
  | { type: 'finalLap'; car: CarId }
  | { type: 'carFinished'; car: CarId; position: number; time: number }
  | { type: 'raceFinished' }
  | { type: 'gunShot'; car: CarId; from: Vec2; to: Vec2; hitCar: CarId | null; hitWall: boolean }
  | { type: 'gunOverheat'; car: CarId }
  | { type: 'carDamaged'; car: CarId; amount: number; source: DamageSource; by: CarId | null; pos: Vec2 }
  | { type: 'carWrecked'; car: CarId; by: CarId | null; pos: Vec2 }
  | { type: 'mineDropped'; mine: number; car: CarId; pos: Vec2 }
  | { type: 'mineExploded'; mine: number; pos: Vec2; hitCars: CarId[] }
  | { type: 'pickupCollected'; pickup: number; car: CarId; kind: PickupKind; pos: Vec2 }
  | { type: 'pickupRespawned'; pickup: number }
  | { type: 'impact'; a: CarId; b: CarId | 'wall'; speed: number; pos: Vec2 } // speed = normal relative speed m/s, emitted when >= 4
  | { type: 'turboStart'; car: CarId }
  | { type: 'turboEnd'; car: CarId };

// ---------------------------------------------------------------- sim API (src/sim/index.ts)

export interface Sim {
  readonly setup: RaceSetup;
  readonly track: TrackGeometry;
  /**
   * Advance exactly one tick (SIM_DT). `inputs` holds frames for non-AI cars only
   * (missing = NEUTRAL_INPUT). Returns the events produced during this tick.
   */
  step(inputs: ReadonlyMap<CarId, InputFrame>): SimEvent[];
  /** Fresh, fully detached copy (safe to keep for interpolation). */
  snapshot(): RaceSnapshot;
  /** Non-null once phase === 'finished'. */
  result(): RaceResult | null;
  /** FNV-1a hash of positions/velocities/hp of all cars, for determinism tests. */
  stateHash(): string;
  /**
   * Dev and test hook only (window.__game, harnesses, tests): end the race now as if the race-end
   * rule fired this tick. Phase becomes 'finished', result() is built with the current live
   * positions, unfinished cars get finished: false. No-op when already finished.
   */
  debugFinishRace(): void;
  dispose(): void;
}

// initPhysics(): Promise<void>  - call once before createSim (loads Rapier WASM).
// createSim(setup: RaceSetup): Sim
// createFakeSim(setup: RaceSetup): Sim  - no physics, for render/UI/audio harnesses.

// ---------------------------------------------------------------- renderer API (src/render/index.ts)

export type Quality = 'low' | 'high';

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  track: TrackGeometry;
  entrants: EntrantSetup[];
  playerCar: CarId;
  quality: Quality;
  cameraShake: boolean;
}

export interface Renderer {
  /**
   * Draw one frame. prev/curr are the last two sim snapshots, alpha in [0,1] blends them.
   * events = all sim events produced since the previous render call (may span several ticks).
   * dt = real seconds since the previous render call (for particles/camera smoothing).
   */
  render(prev: RaceSnapshot, curr: RaceSnapshot, alpha: number, events: readonly SimEvent[], dt: number): void;
  resize(width: number, height: number, pixelRatio: number): void;
  setQuality(q: Quality): void;
  setCameraShake(on: boolean): void;
  /** geometries/textures = THREE renderer.info.memory, so leak checks can compare across races. */
  stats(): { drawCalls: number; triangles: number; fps: number; geometries: number; textures: number };
  /** Frees this race's scene, geometries, materials and textures. The WebGLRenderer itself stays cached per canvas. */
  dispose(): void;
}

// createRenderer(opts: RendererOptions): Promise<Renderer>
//   Reuses one cached THREE.WebGLRenderer per canvas across calls (no new GL context per race),
//   so renderer.info.memory counts stay comparable between races.
// buildCarMesh(spec: CarMeshSpec, color: string): THREE.Group  - also used by the garage preview (M2)

// ---------------------------------------------------------------- audio API (src/audio/index.ts)

export type UiSound = 'move' | 'confirm' | 'back' | 'buy' | 'error';

export interface AudioEngine {
  /** Must be called from a user gesture (keydown/click) before any sound plays. */
  unlock(): Promise<void>;
  setVolumes(master: number, sfx: number): void; // 0..1
  /** Called once per rendered frame with new events and the latest snapshot. */
  update(snapshot: RaceSnapshot, events: readonly SimEvent[], listener: CarId): void;
  /** Called when a race setup is built, before the first update of that race. Index === CarId. maxSpeed is the effective stat (upgrades included). (CCR-9) */
  setRaceCars(cars: readonly { carDefId: string; maxSpeed: number }[]): void;
  /** Silence all race sounds (pause, leaving the race). */
  stopRace(): void;
  ui(sound: UiSound): void;
  dispose(): void;
}

// createAudioEngine(): AudioEngine

// ---------------------------------------------------------------- input API (src/input/index.ts)

export type UiNav = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'pause';

export interface InputSource {
  /** Merged keyboard + first connected gamepad. Call once per sim tick. */
  poll(): InputFrame;
  /** UI navigation events (edge-triggered), keyboard and gamepad. Returns an unsubscribe fn. */
  onNav(cb: (nav: UiNav) => void): () => void;
  /** True if the last input came from a gamepad (UI shows gamepad glyphs). */
  usingGamepad(): boolean;
  dispose(): void;
}

// createInputSource(target: Window): InputSource

// ---------------------------------------------------------------- meta (M2, src/meta/*)

export type RaceTier = 'easy' | 'medium' | 'hard' | 'boss';

export interface RivalState {
  driverId: string;
  name: string;
  color: string;
  carDefId: string;
  skill: number; // 0..1.1
  points: number;
}

export interface SaveGame {
  version: 3; // v1 saves migrate on load: new upgrade kinds 0, wrecks 0, cashEarned 0, sabotage null (CCR-5), bestRank = current rank (CCR-6); v1 and v2 saves migrate with beatenCars [] (CCR-10)
  cash: number;
  carDefId: string;
  upgrades: UpgradeLevels;
  hp: number; // current hp of the player car
  mines: number;
  turbo: number; // seconds
  points: number;
  racesRun: number;
  wins: number;
  rivals: RivalState[]; // 19 rivals, the boss is not in this list
  championWon: boolean;
  bestRank: number; // best (lowest) rank ever reached, 20 at start; drives track unlocks (CCR-6)
  wrecks: number; // career total of wrecks caused by the player (CCR-1)
  cashEarned: number; // career total of payouts (CCR-1)
  /** Sabotage bought for the current round's offer, applied when that offer's race starts, cleared after it (CCR-5). */
  sabotage: { offerId: string; pct: number; price: number } | null; // target is re-picked from that offer's rivals when the race is set up; refunded if another offer is raced (CCR-5)
  rngState: number; // meta RNG state so offers are reproducible
  beatenCars: string[]; // car def ids the player finished ahead of in a career race, each at most once, any order (CCR-10)
}

export interface RaceOffer {
  id: string;
  tier: RaceTier;
  trackId: string;
  laps: number;
  rivals: string[]; // driverIds, 3 rivals
  prizes: number[]; // cash by finishing position, index 0 = 1st
  sabotagePrice: number; // round(0.3 * prizes[0]) (CCR-5)
  points: number[]; // championship points by position
}

export interface Payout {
  prize: number;
  wreckBonus: number;
  pickups: number;
  total: number;
  pointsGained: number;
}

export interface Settings {
  version: 1;
  masterVolume: number; // 0..1
  sfxVolume: number; // 0..1
  quality: Quality;
  cameraShake: boolean;
  showFps: boolean;
  quickTrackId: string | null; // last track picked for quick race; null = first track (CCR-6). `?race=1` ignores it
  quickCarId: string | null; // last car picked for quick race; null or unknown id = raven (CCR-10). `?race=1` ignores it
}

// ---------------------------------------------------------------- game shell <-> UI (src/game/store.ts)

export type Screen =
  | 'boot'
  | 'title'
  | 'controls'
  | 'settings'
  | 'preRace'
  | 'race'
  | 'paused'
  | 'results'
  // M2
  | 'career'
  | 'garage'
  | 'shop'
  | 'raceSelect'
  | 'standings'
  | 'champion';

export interface KillFeedItem {
  id: number;
  text: string; // e.g. "VEX wrecked RAZOR"
  time: number; // race time, items expire after 4 s
}

export interface HudState {
  position: number;
  carCount: number;
  lap: number; // current lap, 1-based, clamped to laps
  laps: number;
  raceTime: number;
  lapTime: number;
  bestLap: number | null;
  speedKmh: number;
  hp: number;
  maxHp: number;
  turbo: number;
  turboActive: boolean;
  mines: number;
  gunHeat: number;
  gunOverheated: boolean;
  countdown: number; // 0 when racing
  banner: string | null; // 'GO!' | 'LAP 2' | 'FINAL LAP' | 'FINISHED' | 'WRECKED', shown 1.5 s
  wrongWay: boolean;
  minimap: { cars: { id: CarId; pos: Vec2; color: string; wrecked: boolean }[] };
  killFeed: KillFeedItem[];
  hitFlash: number; // 0..1, decays; player took damage
}

export interface UiState {
  screen: Screen;
  previousScreen: Screen | null; // where 'back' from settings/controls returns
  settings: Settings;
  usingGamepad: boolean;
  version: string;
  race: {
    trackId: string;
    trackName: string;
    laps: number;
    entrants: { id: CarId; name: string; color: string; carName: string }[];
    minimapPath: Vec2[]; // centerline decimated to ~1 point per 8 m, for the SVG minimap
  } | null;
  hud: HudState | null; // updated at 15 Hz while racing
  results: RaceResult | null;
  // M2
  save: SaveGame | null;
  offers: RaceOffer[] | null;
  selectedOffer: string | null;
  lastPayout: Payout | null;
  toast: { id: number; text: string; kind: 'info' | 'error' | 'cash' } | null;
}

export type GameCommand =
  | { type: 'navigate'; screen: Screen }
  | { type: 'back' }
  | { type: 'startQuickRace' }
  | { type: 'startRace' } // from preRace
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restartRace' }
  | { type: 'quitRace' }
  | { type: 'continueFromResults' }
  | { type: 'setSetting'; patch: Partial<Omit<Settings, 'version'>> }
  // M2
  | { type: 'newCareer' }
  | { type: 'continueCareer' }
  | { type: 'selectOffer'; offerId: string }
  | { type: 'buyUpgrade'; kind: UpgradeKind }
  | { type: 'buyCar'; carDefId: string }
  | { type: 'repair'; amount: 'full' | number }
  | { type: 'buyMines'; count: number }
  | { type: 'buyTurbo'; seconds: number }
  | { type: 'buySabotage' } // for state.selectedOffer, on the preRace screen (CCR-5)
  | { type: 'setQuickTrack'; trackId: string }; // quick race pre-race track picker, persisted in Settings.quickTrackId (CCR-6)

export interface GameStore {
  getState(): UiState;
  subscribe(listener: () => void): () => void; // React useSyncExternalStore compatible
  dispatch(cmd: GameCommand): void;
}
