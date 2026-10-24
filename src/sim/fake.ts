import type { CarId, CarState, PickupKind, RaceResult, RaceSetup, RaceSnapshot, Sim, SimEvent, Vec2 } from '../shared/contracts';
import { SIM_DT, SIM_HZ } from '../shared/contracts';
import { END_AFTER_PLAYER_FINISH, END_AFTER_PLAYER_WRECK } from '../content/race';
import { MAX_MINES_CARRIED, MAX_TURBO_CARRIED, PICKUP_MINES, PICKUP_TURBO_SECONDS } from '../content/pickups';
import { GUN_MUZZLE_OFFSET, GUN_RANGE, MINE_ARM_TIME, MINE_DROP_OFFSET } from '../content/weapons';
import { buildTrackGeometry, createTrackSample } from '../shared/trackGeometry';
import { buildResultFrom, compareRank, stateHashOf, type ResultCar } from './world';

// Fake sim schedule (WP00 spec, fake.ts table). Periods are in seconds of race time, offset by + id seconds per car.
const SPEED_BASE = 0.6; // fraction of maxSpeed for car 0
const SPEED_PER_ID = 0.1;
const SWAY_AMPLITUDE = 3; // m
const SWAY_RATE = 0.7; // rad/s
const SWAY_BLEND = 2; // s to blend from the grid lateral into the sway
const GUN_PERIOD = 2;
const FIRING_WINDOW = 0.5; // s, centred on the shot
const GUN_HEAT_PER_SHOT = 0.25;
const GUN_COOL = 0.2; // per s
const OVERHEAT_PERIOD = 15;
const OVERHEAT_LOCK = 2;
const MINE_PERIOD = 7;
const MINE_FUSE = 1; // s from drop to explosion
const MINE_HIT_RANGE = 6; // m, the car right behind
const MINE_DAMAGE = 30;
const IMPACT_PERIOD = 11;
const IMPACT_SPEED = 9;
const IMPACT_DAMAGE = 10;
const TURBO_PERIOD = 9;
const TURBO_LENGTH = 2;
const PICKUP_PERIOD = 13;
const PICKUP_RESPAWN = 12;
const OFFROAD_PERIOD = 17;
const OFFROAD_LENGTH = 1;
const WRONG_WAY_PERIOD = 23;
const WRONG_WAY_LENGTH = 1.5;
const HP_CYCLE = 40; // s, no per-car offset
const HP_FLOOR = 0.1; // fraction of maxHp at the end of a cycle
const DRIFT_CURVATURE = 1 / 30;
const BRAKE_LOOKAHEAD = 1; // s before a corner
const WRECK_CAR = 3;
const WRECK_BY = 2;
const PICKUP_CYCLE: readonly PickupKind[] = ['cash', 'repair', 'mines', 'turbo'];

const ticks = (seconds: number): number => Math.round(seconds * SIM_HZ);

interface FakeCar extends ResultCar {
  speed: number; // m/s along the centerline, constant
  dist: number; // m driven from the start line (negative on the grid)
  gridLateral: number;
  pos: Vec2;
  heading: number;
  curvature: number;
  lap: number;
  nextCheckpoint: number;
  crossedStart: boolean;
  position: number;
  lastLapTime: number | null;
  currentLapStart: number;
  turboActive: boolean;
  gunHeat: number;
  gunOverheated: boolean;
  firing: boolean;
  braking: boolean;
  drifting: boolean;
  offroad: boolean;
  wrongWay: boolean;
  pickupsTaken: number;
}

interface FakeMine {
  id: number;
  owner: CarId;
  pos: Vec2;
  age: number; // ticks
}

/**
 * No physics: cars follow the centerline on a fixed schedule that exercises every SimEvent type and
 * every CarState flag, for the renderer, UI and audio harnesses. Deterministic (no randomness at all).
 */
export function createFakeSim(setup: RaceSetup): Sim {
  const track = buildTrackGeometry(setup.track);
  const L = track.length;
  const n = track.samples.length;
  const ds = L / n;
  const def = setup.track;
  const smp = createTrackSample();

  // Distance from each sample to the next drifting corner, for the braking flag.
  const isCorner = track.samples.map((s) => Math.abs(s.curvature) > DRIFT_CURVATURE);
  const toCorner = new Float64Array(n).fill(Infinity);
  if (isCorner.some(Boolean)) {
    for (let pass = 0; pass < 2; pass++) {
      for (let i = n - 1; i >= 0; i--) {
        const next = (i + 1) % n;
        toCorner[i] = isCorner[next] ? ds : Math.min(toCorner[i], toCorner[next] + ds);
      }
    }
  }

  const cars: FakeCar[] = setup.entrants.map((e, id) => {
    const row = Math.floor(id / 2);
    const column = id % 2;
    const slot = track.grid[id];
    if (!slot) throw new Error(`no grid slot for entrant ${id}`);
    const dist = -8 - row * 8 - column * 4;
    return {
      id,
      entrant: e,
      speed: (SPEED_BASE + SPEED_PER_ID * id) * e.stats.maxSpeed,
      dist,
      gridLateral: column === 0 ? -3 : 3,
      pos: { x: slot.pos.x, y: slot.pos.y },
      heading: slot.heading,
      curvature: 0,
      progress: dist,
      hp: e.hp,
      mines: e.mines,
      turbo: e.turbo,
      finished: false,
      finishTime: null,
      wrecked: false,
      wreckedAt: null,
      bestLapTime: null,
      wrecksCaused: 0,
      cashPicked: 0,
      lap: 0,
      nextCheckpoint: 0,
      crossedStart: false,
      position: id + 1,
      lastLapTime: null,
      currentLapStart: 0,
      turboActive: false,
      gunHeat: 0,
      gunOverheated: false,
      firing: false,
      braking: false,
      drifting: false,
      offroad: false,
      wrongWay: false,
      pickupsTaken: 0,
    };
  });

  const pickups = def.pickups.map((p, id) => {
    const s = track.sampleAt(p.s);
    return { id, kind: p.kind, pos: { x: s.pos.x + s.right.x * p.lateral, y: s.pos.y + s.right.y * p.lateral }, active: true, respawn: 0 };
  });
  const mines: FakeMine[] = [];
  let nextMineId = 0;
  let tick = 0;
  let raceTicks = 0;
  let phase: RaceSnapshot['phase'] = 'countdown';
  let countdown = setup.countdownSeconds;
  let result: RaceResult | null = null;
  let playerFinishedAt: number | null = null;
  let playerWreckedAt: number | null = null;
  let out: SimEvent[] = [];

  const carAhead = (c: FakeCar): FakeCar | null => cars.find((o) => o.position === c.position - 1) ?? null;
  const carBehind = (c: FakeCar): FakeCar | null => cars.find((o) => o.position === c.position + 1) ?? null;
  const fwdPoint = (c: FakeCar, d: number): Vec2 => ({ x: c.pos.x + Math.cos(c.heading) * d, y: c.pos.y + Math.sin(c.heading) * d });

  const updateRanks = (): void => {
    [...cars].sort(compareRank).forEach((c, i) => (c.position = i + 1));
  };

  const finish = (): void => {
    phase = 'finished';
    countdown = 0;
    result = buildResultFrom(setup, cars);
    out.push({ type: 'raceFinished' });
  };

  const place = (c: FakeCar, time: number): void => {
    const s = ((c.dist % L) + L) % L;
    track.sampleAtInto(smp, s);
    const sway = Math.sin(time * SWAY_RATE + c.id) * SWAY_AMPLITUDE;
    let lateral = c.gridLateral + (sway - c.gridLateral) * Math.min(1, time / SWAY_BLEND);
    if (c.offroad) lateral = (lateral >= 0 ? 1 : -1) * (def.width / 2 + 1);
    c.pos.x = smp.pos.x + smp.right.x * lateral;
    c.pos.y = smp.pos.y + smp.right.y * lateral;
    c.heading = Math.atan2(smp.tangent.y, smp.tangent.x);
    c.curvature = smp.curvature;
    const i = Math.min(n - 1, Math.floor(s / ds));
    c.drifting = isCorner[i];
    c.braking = !c.drifting && toCorner[i] <= c.speed * BRAKE_LOOKAHEAD;
    if (c.crossedStart) {
      const sLap = c.dist - c.lap * L;
      c.nextCheckpoint = (Math.floor(sLap / (L / track.checkpoints.length)) + 1) % track.checkpoints.length;
    }
  };

  /** Scheduled actions for one car this tick; lt = ticks since green minus the car's id offset. */
  const schedule = (c: FakeCar, k: number, time: number): void => {
    const lt = k - c.id * SIM_HZ;
    const since = (period: number): number => (lt >= ticks(period) ? lt % ticks(period) : Infinity);

    // Gun heat, overheat and shots.
    c.gunHeat = Math.max(0, c.gunHeat - GUN_COOL * SIM_DT);
    if (since(OVERHEAT_PERIOD) === 0) {
      c.gunHeat = 1;
      out.push({ type: 'gunOverheat', car: c.id });
    }
    c.gunOverheated = since(OVERHEAT_PERIOD) < ticks(OVERHEAT_LOCK);
    const half = ticks(FIRING_WINDOW / 2);
    const gp = ticks(GUN_PERIOD);
    c.firing = !c.gunOverheated && lt + half >= gp && (lt + half) % gp < 2 * half;
    if (since(GUN_PERIOD) === 0 && !c.gunOverheated) {
      c.gunHeat = Math.min(1, c.gunHeat + GUN_HEAT_PER_SHOT);
      const from = fwdPoint(c, c.entrant.mesh.length / 2 + GUN_MUZZLE_OFFSET);
      const target = carAhead(c);
      const to = target && !target.wrecked ? { x: target.pos.x, y: target.pos.y } : fwdPoint(c, GUN_RANGE);
      out.push({ type: 'gunShot', car: c.id, from, to, hitCar: target && !target.wrecked ? target.id : null, hitWall: !target || target.wrecked });
    }

    if (since(MINE_PERIOD) === 0) {
      const pos = fwdPoint(c, -(c.entrant.mesh.length / 2 + MINE_DROP_OFFSET));
      const id = nextMineId++;
      mines.push({ id, owner: c.id, pos, age: 0 });
      c.mines = Math.max(0, c.mines - 1);
      out.push({ type: 'mineDropped', mine: id, car: c.id, pos: { x: pos.x, y: pos.y } });
    }

    if (since(IMPACT_PERIOD) === 0) {
      out.push({ type: 'impact', a: c.id, b: 'wall', speed: IMPACT_SPEED, pos: { x: c.pos.x, y: c.pos.y } });
      out.push({ type: 'carDamaged', car: c.id, amount: IMPACT_DAMAGE, source: 'wall', by: null, pos: { x: c.pos.x, y: c.pos.y } });
    }

    const turboSince = since(TURBO_PERIOD);
    if (turboSince === 0) out.push({ type: 'turboStart', car: c.id });
    if (turboSince === ticks(TURBO_LENGTH)) out.push({ type: 'turboEnd', car: c.id });
    c.turboActive = turboSince < ticks(TURBO_LENGTH);
    if (c.turboActive) c.turbo = Math.max(0, c.turbo - SIM_DT);

    if (since(PICKUP_PERIOD) === 0) {
      const want = PICKUP_CYCLE[c.pickupsTaken % PICKUP_CYCLE.length];
      const d2 = (p: Vec2): number => (p.x - c.pos.x) ** 2 + (p.y - c.pos.y) ** 2;
      const nearest = (kind: PickupKind | null) =>
        pickups.filter((p) => p.active && (kind === null || p.kind === kind)).sort((a, b) => d2(a.pos) - d2(b.pos))[0];
      const p = nearest(want ?? null) ?? nearest(null);
      if (p) {
        p.active = false;
        p.respawn = ticks(PICKUP_RESPAWN);
        c.pickupsTaken++;
        if (p.kind === 'cash') c.cashPicked += 1;
        if (p.kind === 'mines') c.mines = Math.min(MAX_MINES_CARRIED, c.mines + PICKUP_MINES);
        if (p.kind === 'turbo') c.turbo = Math.min(MAX_TURBO_CARRIED, c.turbo + PICKUP_TURBO_SECONDS);
        out.push({ type: 'pickupCollected', pickup: p.id, car: c.id, kind: p.kind, pos: { x: p.pos.x, y: p.pos.y } });
      }
    }

    c.offroad = since(OFFROAD_PERIOD) < ticks(OFFROAD_LENGTH);
    c.wrongWay = since(WRONG_WAY_PERIOD) < ticks(WRONG_WAY_LENGTH);

    // hp: linear drain from maxHp to 10% per cycle with one gun hit per second; car 3 wrecks at the first cycle end.
    if (k > 0 && k % SIM_HZ === 0) {
      const maxHp = c.entrant.stats.maxHp;
      const cycle = k % ticks(HP_CYCLE);
      if (cycle === 0) {
        if (c.id === WRECK_CAR && !c.finished) {
          const by = cars[WRECK_BY] ?? null;
          c.hp = 0;
          c.wrecked = true;
          c.wreckedAt = time;
          c.firing = c.turboActive = c.braking = c.drifting = c.offroad = c.wrongWay = c.gunOverheated = false;
          if (by) by.wrecksCaused++;
          out.push({ type: 'carWrecked', car: c.id, by: by ? by.id : null, pos: { x: c.pos.x, y: c.pos.y } });
        } else {
          c.hp = maxHp;
        }
      } else {
        c.hp = maxHp * (1 - ((1 - HP_FLOOR) * cycle) / ticks(HP_CYCLE));
        const by = carAhead(c);
        out.push({
          type: 'carDamaged',
          car: c.id,
          amount: ((1 - HP_FLOOR) * maxHp) / HP_CYCLE,
          source: 'gun',
          by: by ? by.id : null,
          pos: { x: c.pos.x, y: c.pos.y },
        });
      }
    }
  };

  const raceTick = (): void => {
    const k = raceTicks;
    const time = k * SIM_DT;
    const justFinished: FakeCar[] = [];
    for (const c of cars) {
      if (c.wrecked) continue;
      c.dist += c.speed * SIM_DT;
      if (!c.crossedStart && c.dist >= 0) {
        c.crossedStart = true;
        c.currentLapStart = time;
      }
      while (c.crossedStart && Math.floor(c.dist / L) > c.lap) {
        c.lap++;
        const lapTime = time - c.currentLapStart;
        c.lastLapTime = lapTime;
        c.bestLapTime = c.bestLapTime === null ? lapTime : Math.min(c.bestLapTime, lapTime);
        c.currentLapStart = time;
        if (!c.finished) {
          out.push({ type: 'lapCompleted', car: c.id, lap: c.lap, lapTime });
          if (c.lap === setup.laps - 1) out.push({ type: 'finalLap', car: c.id });
          if (c.lap === setup.laps) {
            c.finished = true;
            c.finishTime = time;
            justFinished.push(c);
            if (c.id === 0) playerFinishedAt = time;
          }
        }
      }
      c.progress = c.dist;
    }
    updateRanks();
    for (const c of justFinished) out.push({ type: 'carFinished', car: c.id, position: c.position, time: c.finishTime as number });

    for (const c of cars) if (!c.wrecked) schedule(c, k, time);
    for (const c of cars) if (!c.wrecked) place(c, time);

    for (let i = mines.length - 1; i >= 0; i--) {
      const m = mines[i];
      m.age++;
      if (m.age < ticks(MINE_FUSE)) continue;
      mines.splice(i, 1);
      const owner = cars[m.owner];
      const victim = owner ? carBehind(owner) : null;
      const hit = victim && !victim.wrecked && Math.hypot(victim.pos.x - m.pos.x, victim.pos.y - m.pos.y) <= MINE_HIT_RANGE ? victim : null;
      out.push({ type: 'mineExploded', mine: m.id, pos: { x: m.pos.x, y: m.pos.y }, hitCars: hit ? [hit.id] : [] });
      if (hit) out.push({ type: 'carDamaged', car: hit.id, amount: MINE_DAMAGE, source: 'mine', by: m.owner, pos: { x: hit.pos.x, y: hit.pos.y } });
    }
    for (const p of pickups) {
      if (p.active || --p.respawn > 0) continue;
      p.active = true;
      out.push({ type: 'pickupRespawned', pickup: p.id });
    }

    updateRanks();
    const player = cars[0];
    if (player?.wrecked && playerWreckedAt === null) playerWreckedAt = time;
    const allDone = cars.every((c) => c.wrecked || c.finished);
    if (
      allDone ||
      (playerFinishedAt !== null && time - playerFinishedAt >= END_AFTER_PLAYER_FINISH) ||
      (playerWreckedAt !== null && time - playerWreckedAt >= END_AFTER_PLAYER_WRECK)
    ) {
      finish();
    }
  };

  const step = (): SimEvent[] => {
    if (phase === 'countdown') {
      const left = ticks(setup.countdownSeconds) - tick;
      if (left <= 0) {
        phase = 'racing';
        countdown = 0;
        out.push({ type: 'raceStart' });
      } else {
        const value = left / SIM_HZ;
        if (value === 3 || value === 2 || value === 1) out.push({ type: 'countdown', value });
        countdown = (left - 1) / SIM_HZ;
      }
    }
    if (phase === 'racing') {
      raceTick();
      raceTicks++;
    } else if (phase === 'finished') {
      // Cars coast on along the line, no race events.
      const time = raceTicks * SIM_DT;
      for (const c of cars) {
        if (c.wrecked) continue;
        c.dist += c.speed * SIM_DT;
        c.firing = c.turboActive = c.offroad = c.wrongWay = false;
        place(c, time);
      }
    }
    tick++;
    const events = out;
    out = [];
    return events;
  };

  const snapshotCar = (c: FakeCar): CarState => ({
    id: c.id,
    pos: { x: c.pos.x, y: c.pos.y },
    heading: c.heading,
    vel: c.wrecked ? { x: 0, y: 0 } : { x: Math.cos(c.heading) * c.speed, y: Math.sin(c.heading) * c.speed },
    angVel: c.wrecked ? 0 : c.curvature * c.speed,
    speed: c.wrecked ? 0 : c.speed,
    hp: c.hp,
    maxHp: c.entrant.stats.maxHp,
    mines: c.mines,
    turbo: c.turbo,
    turboActive: c.turboActive,
    gunHeat: c.gunHeat,
    gunOverheated: c.gunOverheated,
    firing: c.firing,
    braking: c.braking,
    drifting: c.drifting,
    offroad: c.offroad,
    wrecked: c.wrecked,
    lap: c.lap,
    nextCheckpoint: c.nextCheckpoint,
    progress: c.progress,
    position: c.position,
    finished: c.finished,
    finishTime: c.finishTime,
    lastLapTime: c.lastLapTime,
    bestLapTime: c.bestLapTime,
    currentLapStart: c.currentLapStart,
    wrongWay: c.wrongWay,
  });

  return {
    setup,
    track,
    step,
    snapshot: (): RaceSnapshot => ({
      tick,
      time: raceTicks * SIM_DT,
      phase,
      countdown,
      laps: setup.laps,
      cars: cars.map(snapshotCar),
      mines: mines.map((m) => ({ id: m.id, owner: m.owner, pos: { x: m.pos.x, y: m.pos.y }, armed: m.age >= ticks(MINE_ARM_TIME) })),
      pickups: pickups.map((p) => ({ id: p.id, kind: p.kind, pos: { x: p.pos.x, y: p.pos.y }, active: p.active })),
    }),
    result: () => result,
    stateHash: () =>
      stateHashOf(
        tick,
        cars.map((c) => {
          const s = snapshotCar(c);
          return { x: s.pos.x, y: s.pos.y, vx: s.vel.x, vy: s.vel.y, heading: s.heading, hp: s.hp };
        }),
      ),
    debugFinishRace: () => {
      if (phase === 'finished') return;
      updateRanks();
      finish();
    },
    dispose: () => {},
  };
}
