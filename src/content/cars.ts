import type { CarDef, CarMeshSpec, CarStats } from '../shared/contracts';

type Row = [id: string, name: string, forSale: boolean, price: number, tier: 1 | 2 | 3, stats: CarStats, mesh: CarMeshSpec];

const stats = (maxSpeed: number, accel: number, brake: number, turnRate: number, grip: number, mass: number, maxHp: number, gunDps: number): CarStats => ({
  maxSpeed,
  accel,
  brake,
  turnRate,
  grip,
  mass,
  maxHp,
  gunDps,
  // CCR-5: the same for every car (content.md section 1); the fuel and spikes upgrades add to them.
  turboSpeedMult: 1.3,
  turboAccelMult: 1.6,
  ramDealtMult: 1,
  ramTakenMult: 1,
});

const mesh = (
  style: CarMeshSpec['style'],
  length: number,
  width: number,
  height: number,
  cabinLength: number,
  cabinOffset: number,
  spoiler: boolean,
  wheelRadius: number,
): CarMeshSpec => ({ style, length, width, height, cabinLength, cabinOffset, spoiler, wheelRadius, model: null, spikes: 0 });

// content.md section 1, in table order (carsForSale keeps this order). Tuning pass 1: maxSpeed x1.15, accel x1.20.
const ROWS: Row[] = [
  ['raven', 'Raven', false, 0, 1, stats(39.1, 15.6, 24, 2.7, 0.78, 1100, 100, 22), mesh('muscle', 4.2, 2.0, 0.7, 0.45, -0.05, true, 0.38)],
  ['outlaw', 'Outlaw', false, 0, 1, stats(38, 18, 24, 3.1, 0.8, 850, 80, 20), mesh('buggy', 3.8, 2.0, 0.6, 0.5, -0.05, false, 0.48)],
  ['iceberg', 'Iceberg', false, 0, 1, stats(36.8, 14.4, 22, 2.4, 0.76, 1500, 135, 22), mesh('wagon', 4.9, 2.1, 0.8, 0.62, -0.12, false, 0.4)],
  ['scorch', 'Scorch', true, 6000, 2, stats(42.6, 18, 25, 2.5, 0.8, 1400, 140, 26), mesh('muscle', 4.8, 2.2, 0.8, 0.38, -0.12, true, 0.42)],
  ['blaze', 'Blaze', false, 0, 2, stats(46, 19.2, 27, 2.8, 0.84, 1150, 110, 26), mesh('wedge', 4.4, 2.0, 0.55, 0.3, -0.08, true, 0.36)],
  ['titan', 'Titan', true, 9000, 2, stats(40.3, 15.6, 26, 2.2, 0.8, 1900, 190, 32), mesh('truck', 5.2, 2.4, 1.0, 0.35, 0.05, false, 0.52)],
  ['viper', 'Viper', true, 12000, 3, stats(49.5, 20.4, 28, 2.9, 0.88, 1200, 120, 30), mesh('wedge', 4.5, 2.0, 0.55, 0.3, -0.1, true, 0.36)],
  ['wraith', 'Wraith', false, 0, 3, stats(51.8, 21.6, 30, 2.9, 0.9, 1700, 220, 34), mesh('boss', 5.2, 2.4, 0.9, 0.4, -0.08, true, 0.46)],
];

export const CARS: Record<string, CarDef> = Object.fromEntries(
  ROWS.map(([id, name, forSale, price, tier, base, m]) => [id, { id, name, forSale, price, tier, base, mesh: m }]),
);

/** The M1 car for every entrant, and the career starter. */
export const STARTER_CAR_ID = 'raven';

export function getCar(id: string): CarDef {
  const car = CARS[id];
  if (!car) throw new Error(`unknown car '${id}'`);
  return car;
}

export function carsForSale(): CarDef[] {
  return Object.values(CARS).filter((c) => c.forSale);
}
