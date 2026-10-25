import { getNoise } from './noise';
import type { Voice } from './voices';

// One-shot synth recipes (WP05 "Synthesis recipes"). Base gains here; callers pass a distance/intensity multiplier.
export const SFX_NAMES = [
  'gun',
  'overheat',
  'explosionWreck',
  'explosionMine',
  'impact',
  'mineBeep',
  'pickupCash',
  'pickupRepair',
  'pickupMines',
  'pickupTurbo',
  'turbo',
  'countdown',
  'raceStart',
  'uiMove',
  'uiConfirm',
  'uiBack',
  'uiBuy',
  'uiError',
  'lapCompleted',
  'carDamaged',
  'mineDropped',
] as const;
export type SfxName = (typeof SFX_NAMES)[number];

/** Loudness group of each sound (import table in specs/sfx/list.md); MIX.category scales a whole group. */
export type SfxCategory = 'combat' | 'pickups' | 'ui';
export const SFX_CATEGORY: Readonly<Record<SfxName, SfxCategory>> = {
  gun: 'combat',
  overheat: 'combat',
  explosionWreck: 'combat',
  explosionMine: 'combat',
  impact: 'combat',
  mineBeep: 'combat',
  turbo: 'combat',
  carDamaged: 'combat',
  mineDropped: 'combat',
  pickupCash: 'pickups',
  pickupRepair: 'pickups',
  pickupMines: 'pickups',
  pickupTurbo: 'pickups',
  countdown: 'ui',
  raceStart: 'ui',
  lapCompleted: 'ui',
  uiMove: 'ui',
  uiConfirm: 'ui',
  uiBack: 'ui',
  uiBuy: 'ui',
  uiError: 'ui',
};

/** Combat sounds that repeat fast get a random pitch each time, so rapid fire does not sound robotic. */
export const PITCH_JITTER: ReadonlySet<SfxName> = new Set<SfxName>(['gun', 'impact', 'carDamaged', 'mineDropped', 'explosionMine', 'explosionWreck']);
export const PITCH_VARIATION = 0.04; // +-4 %

/** Playback rate in [1 - 4 %, 1 + 4 %]; `rng` returns [0, 1). */
export function pitchRate(rng: () => number = Math.random): number {
  return 1 + (rng() * 2 - 1) * PITCH_VARIATION;
}

const SILENT = 0.0001; // exponential ramps cannot reach 0
const ATTACK = 0.003;
const TAIL = 0.02; // s after the envelope before sources stop

class Shot {
  private readonly out: GainNode;
  private readonly sources: AudioScheduledSourceNode[] = [];
  end = 0;

  constructor(
    private readonly ctx: BaseAudioContext,
    dest: AudioNode,
    gain: number,
    pan: number,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = gain;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    this.out.connect(panner);
    panner.connect(dest);
  }

  private envelope(t0: number, dur: number, peak: number, attack: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(SILENT, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(SILENT, t0 + dur);
    g.connect(this.out);
    return g;
  }

  private run(src: AudioScheduledSourceNode, t0: number, dur: number): void {
    src.start(t0);
    src.stop(t0 + dur + TAIL);
    this.end = Math.max(this.end, t0 + dur + TAIL);
    this.sources.push(src);
  }

  tone(type: OscillatorType, f0: number, f1: number, t0: number, dur: number, peak: number): this {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    osc.connect(this.envelope(t0, dur, peak, ATTACK));
    this.run(osc, t0, dur);
    return this;
  }

  noise(
    pink: boolean,
    filter: BiquadFilterType,
    f0: number,
    f1: number,
    q: number,
    t0: number,
    dur: number,
    peak: number,
    attack = ATTACK,
  ): this {
    const noise = getNoise(this.ctx);
    const src = this.ctx.createBufferSource();
    src.buffer = pink ? noise.pink : noise.white;
    src.loop = true;
    const biquad = this.ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.Q.value = q;
    biquad.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) biquad.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    src.connect(biquad);
    biquad.connect(this.envelope(t0, dur, peak, attack));
    this.run(src, t0, dur);
    return this;
  }

  voice(): Voice {
    let left = this.sources.length;
    const disconnect = (): void => this.out.disconnect();
    for (const s of this.sources)
      s.onended = () => {
        if (--left === 0) disconnect();
      };
    return {
      end: this.end,
      stop: () => {
        for (const s of this.sources) {
          s.onended = null;
          s.stop();
        }
        disconnect();
      },
    };
  }
}

const notes = (s: Shot, type: OscillatorType, freqs: readonly number[], t0: number, each: number, peak: number): Shot => {
  freqs.forEach((f, i) => s.tone(type, f, f, t0 + i * each, each, peak));
  return s;
};

const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;
const G5 = 784;
const E5 = 659.3;

/** Plays `name` at time `t0` into `dest`; `gain` multiplies the recipe's base gain. */
export function playSfx(ctx: BaseAudioContext, dest: AudioNode, name: SfxName, t0: number, gain: number, pan: number): Voice {
  const shot = (base: number): Shot => new Shot(ctx, dest, base * gain, pan);
  switch (name) {
    case 'gun':
      return shot(0.18).noise(false, 'bandpass', 1800, 1800, 1.2, t0, 0.04, 1).tone('square', 140, 140, t0, 0.03, 0.6).voice();
    case 'overheat':
      return shot(0.25).tone('sine', 900, 300, t0, 0.4, 1).noise(false, 'highpass', 4000, 4000, 0.7, t0, 0.4, 0.5).voice();
    case 'explosionWreck':
    case 'explosionMine':
      return shot(name === 'explosionWreck' ? 0.8 : 0.55)
        .noise(true, 'lowpass', 2000, 200, 0.7, t0, 1.2, 1, 0.005)
        .tone('sine', 60, 60, t0, 0.25, 1)
        .voice();
    case 'impact':
      return shot(0.5)
        .noise(false, 'lowpass', 600, 600, 0.7, t0, 0.08, 1)
        .tone('triangle', 380, 380, t0, 0.15, 0.45)
        .tone('triangle', 523, 523, t0, 0.15, 0.35)
        .voice();
    case 'mineBeep':
      return shot(0.15).tone('sine', 1400, 1400, t0, 0.04, 1).voice();
    case 'pickupCash':
      return notes(shot(0.22), 'sine', [C6, E6, G6], t0, 0.06, 1).voice();
    case 'pickupRepair':
      return notes(shot(0.22), 'sine', [G5, C6], t0, 0.06, 1).voice();
    case 'pickupMines':
      return notes(shot(0.22), 'sine', [E5, E5], t0, 0.06, 1).voice();
    case 'pickupTurbo':
      return shot(0.22).tone('sine', 400, 1600, t0, 0.18, 1).voice();
    case 'turbo':
      return shot(0.35).noise(false, 'bandpass', 300, 2500, 1.5, t0, 0.6, 1, 0.15).voice();
    case 'countdown':
      return shot(0.3).tone('sine', 600, 600, t0, 0.15, 1).voice();
    case 'raceStart':
      return shot(0.3).tone('sine', 1200, 1200, t0, 0.4, 1).voice();
    case 'uiMove':
      return shot(0.15).tone('triangle', 900, 900, t0, 0.03, 1).voice();
    case 'uiConfirm':
      return notes(shot(0.18), 'triangle', [660, 990], t0, 0.05, 1).voice();
    case 'uiBack':
      return notes(shot(0.18), 'triangle', [990, 660], t0, 0.05, 1).voice();
    case 'uiBuy':
      return notes(shot(0.2).noise(false, 'highpass', 3000, 3000, 0.7, t0, 0.06, 0.8), 'triangle', [1320, 1760], t0 + 0.04, 0.07, 1).voice();
    case 'uiError':
      return shot(0.18).tone('sawtooth', 120, 120, t0, 0.15, 1).voice();
    case 'lapCompleted':
      return shot(0.22).tone('sine', E6, E6, t0, 0.35, 1).tone('sine', E6 * 2, E6 * 2, t0, 0.25, 0.35).voice();
    case 'carDamaged':
      return shot(0.4).noise(false, 'lowpass', 900, 900, 0.7, t0, 0.07, 1).tone('square', 90, 60, t0, 0.06, 0.5).voice();
    case 'mineDropped':
      return shot(0.35).tone('sine', 180, 90, t0, 0.08, 1).noise(false, 'bandpass', 1200, 1200, 2, t0, 0.03, 0.5).voice();
  }
}
