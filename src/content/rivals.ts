// content.md section 10

export interface RivalDef {
  driverId: string;
  name: string;
  color: string;
  carDefId: string;
  skill: number;
}

const r = (driverId: string, name: string, color: string, carDefId: string, skill: number): RivalDef => ({ driverId, name, color, carDefId, skill });

export const RIVALS: readonly RivalDef[] = [
  r('r01', 'ROOK', '#8C9AA8', 'outlaw', 0.1),
  r('r02', 'BRISKET', '#C9824A', 'iceberg', 0.15),
  r('r03', 'SPROCKET', '#6FCF5B', 'raven', 0.2),
  r('r04', 'MAGPIE', '#E8E8E8', 'outlaw', 0.25),
  r('r05', 'RUSTY', '#B5532E', 'iceberg', 0.3),
  r('r06', 'VEX', '#2EA8FF', 'raven', 0.35),
  r('r07', 'GRIT', '#A3A35C', 'outlaw', 0.4),
  r('r08', 'KILN', '#E0703A', 'scorch', 0.45),
  r('r09', 'MOTH', '#F5D547', 'blaze', 0.5),
  r('r10', 'RAZOR', '#B65CFF', 'titan', 0.55),
  r('r11', 'OXIDE', '#3FB6A8', 'scorch', 0.6),
  r('r12', 'JINX', '#FF4FA3', 'blaze', 0.65),
  r('r13', 'CINDER', '#FF7A45', 'titan', 0.7),
  r('r14', 'TALON', '#5C7CFF', 'viper', 0.75),
  r('r15', 'VOLT', '#C6FF3D', 'viper', 0.8),
  r('r16', 'DUCHESS', '#D9B26F', 'blaze', 0.85),
  r('r17', 'HALO', '#F2F2FF', 'viper', 0.9),
  r('r18', 'NOVA', '#45E0FF', 'titan', 0.93),
  r('r19', 'BANSHEE', '#FF3355', 'viper', 0.96),
];

/** The boss is not in RIVALS. `color` is the body, `trim` the accent. */
export const BOSS: RivalDef & { trim: string } = { driverId: 'boss', name: 'THE WARDEN', color: '#1A1A1A', trim: '#FF3355', carDefId: 'wraith', skill: 1.1 };

export const initialRivalPoints = (skill: number): number => Math.round(skill * 40);

/** Every upgrade line of a rival car except spikes is at this level (fuel included). */
export const rivalUpgradeLevel = (skill: number): number => Math.min(5, Math.floor(skill * 5));

/** A rival car's bumper spikes level (CCR-5); the boss (skill 1.1) gets 3. */
export const rivalSpikesLevel = (skill: number): number => Math.min(3, Math.floor(skill * 3));
