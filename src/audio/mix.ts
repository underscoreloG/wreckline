import type { SfxCategory, SfxName } from './sfx';

// The mix (WP16): every level in the game's audio lives here. Linear gains, 1 = unchanged; x2 = +6 dB, x0.5 = -6 dB.
// The sample files are loudness-matched inside each category by scripts/sfx/importSfx.mjs, so `sound` only sets the
// balance inside a category and `category` moves a whole group. Sample gain = category * sound. The synth fallback
// recipes keep WP05's own levels (sfx.ts) and only follow `bus`, `engine` and `skid`.
// Change levels here only, and log each change in docs/tuning-log.md.
export const MIX = {
  // Buses: race (engine, skid and every race sound; faded by stopRace) and ui (menu sounds), both under sfx; music
  // (WP35) goes straight to master, times the music volume setting.
  bus: { race: 1, ui: 1, music: 0.45 },
  // Music (WP35): every track file is normalised to one loudness by scripts/sfx/importMusic.mjs. At the default
  // settings a race track sits at least 10 LU under the race sounds ("in the background, not too loud"), the menu
  // track a little quieter still.
  music: { race: 1, menu: 0.8 } satisfies Record<'race' | 'menu', number>,
  // Engine voices (synth only): player and AI (AI is also distance-scaled).
  engine: { player: 0.28, ai: 0.12 },
  // Skid while drifting (synth only).
  skid: 0.12,
  // Whole groups of samples, the listening session's "too quiet / ok / too loud" knobs. The ui files are
  // normalised ~6 LU hotter than combat and pickups, hence 0.5.
  category: { combat: 1, pickups: 1, ui: 0.5 } satisfies Record<SfxCategory, number>,
  sound: {
    // combat. Starting points from the offline check (engine: peak -8 dBFS). gun at 1 peaks at -10.5 dBFS, ~7 dB over
    // WP05's synth gun (which sat ~10 dB under the engine). The wreck is the biggest sound in the game.
    gun: 1,
    overheat: 1.4,
    explosionWreck: 2.5,
    explosionMine: 1.4,
    impact: 1.2, // times min(1, speed / 25)
    mineBeep: 1,
    turbo: 0.7, // whoosh over the engine; the sample is far louder than the synth whoosh was
    carDamaged: 1.2,
    mineDropped: 1,
    // pickups: the player's own pickups only.
    pickupCash: 1,
    pickupRepair: 1,
    pickupMines: 1,
    pickupTurbo: 1,
    // ui: menus, plus the race cues countdown, raceStart and lapCompleted (on the race bus, so raised over the engine).
    countdown: 1.6,
    raceStart: 1.6,
    lapCompleted: 1.6,
    uiMove: 1,
    uiConfirm: 1,
    uiBack: 1,
    uiBuy: 1,
    uiError: 1,
  } satisfies Record<SfxName, number>,
};
