export const COMPRESSOR_THRESHOLD = -18; // dB
export const COMPRESSOR_RATIO = 4;
const VOLUME_RAMP = 0.05; // s
const RACE_FADE = 0.1; // s

/** race + ui -> sfx gain -> master gain -> compressor -> destination. */
export interface Bus {
  ctx: BaseAudioContext;
  master: GainNode;
  sfx: GainNode;
  race: GainNode;
  ui: GainNode;
  out: DynamicsCompressorNode;
}

export function buildBus(ctx: BaseAudioContext): Bus {
  const out = ctx.createDynamicsCompressor();
  out.threshold.value = COMPRESSOR_THRESHOLD;
  out.ratio.value = COMPRESSOR_RATIO;
  const master = ctx.createGain();
  const sfx = ctx.createGain();
  const race = ctx.createGain();
  const ui = ctx.createGain();
  race.connect(sfx);
  ui.connect(sfx);
  sfx.connect(master);
  master.connect(out);
  out.connect(ctx.destination);
  return { ctx, master, sfx, race, ui, out };
}

/** Linear ramp from the current value, so repeated calls never jump. */
export function rampTo(param: AudioParam, value: number, now: number, seconds: number): void {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + seconds);
}

export function setBusVolumes(bus: Bus, master: number, sfx: number): void {
  const now = bus.ctx.currentTime;
  rampTo(bus.master.gain, master, now, VOLUME_RAMP);
  rampTo(bus.sfx.gain, sfx, now, VOLUME_RAMP);
}

export function fadeRace(bus: Bus, on: boolean): number {
  const now = bus.ctx.currentTime;
  rampTo(bus.race.gain, on ? 1 : 0, now, on ? VOLUME_RAMP : RACE_FADE);
  return now + RACE_FADE;
}
