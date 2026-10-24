import type { SimSystem } from './internal';

// STUBS (WP00), WP02 replaces the bodies and keeps the signatures.

export const updateTurbo: SimSystem = () => {};

/** The stub still drains the event queue so it never grows. */
export const handleCollisions: SimSystem = (world) => {
  world.events.drainCollisionEvents(() => {});
};

export const updateGuns: SimSystem = () => {};

export const updateMines: SimSystem = () => {};

export const updatePickups: SimSystem = () => {};
