// content.md section 4: multipliers on base stats while the state holds.

// Turbo (rocket fuel) multipliers are per car: CarStats.turboSpeedMult / turboAccelMult (CCR-5).
export const TURBO_DRAIN = 1; // turbo seconds per second

export const OFFROAD_MODS = { maxSpeed: 0.7, accel: 0.8, grip: 0.6 } as const;
export const OFFROAD_DRAG = 4; // m/s^2 opposing velocity

export const HANDBRAKE_MODS = { accel: 0, grip: 0.35, turnRate: 1.4 } as const;

export const WRECKED_LINEAR_DAMPING = 2.5;
export const WRECKED_ANGULAR_DAMPING = 3;
