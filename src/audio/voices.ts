// Mixing rules shared by every race sound (WP05): distance falloff, stereo pan and the voice cap.
export const MAX_VOICES = 48;
export const FALLOFF_DISTANCE = 25; // m, gain halves at this distance
export const SILENT_BEYOND = 120; // m
export const PAN_DISTANCE = 60; // m of x offset for a hard pan

/** 1 / (1 + d / 25), silent beyond 120 m. */
export function distanceFalloff(d: number): number {
  return d > SILENT_BEYOND ? 0 : 1 / (1 + d / FALLOFF_DISTANCE);
}

/** Pan from the x offset to the listener, clamped to [-1, 1]. */
export function panFor(dx: number): number {
  return Math.max(-1, Math.min(1, dx / PAN_DISTANCE));
}

/** A live sound: `end` is its scheduled end in AudioContext time, `stop` silences it at once. */
export interface Voice {
  end: number;
  stop(): void;
}

/** Live one-shot voices under a cap; adding past the cap stops the oldest first. */
export class VoicePool {
  private live: Voice[] = [];

  constructor(private cap: number) {}

  setCap(cap: number): void {
    this.cap = Math.max(0, cap);
  }

  add(v: Voice, now: number): void {
    this.prune(now);
    while (this.live.length > 0 && this.live.length >= this.cap) this.live.shift()?.stop();
    if (this.cap === 0) {
      v.stop();
      return;
    }
    this.live.push(v);
  }

  remove(v: Voice): void {
    const i = this.live.indexOf(v);
    if (i >= 0) this.live.splice(i, 1);
  }

  count(now: number): number {
    this.prune(now);
    return this.live.length;
  }

  stopAll(): void {
    for (const v of this.live) v.stop();
    this.live.length = 0;
  }

  private prune(now: number): void {
    let w = 0;
    for (const v of this.live) if (v.end > now) this.live[w++] = v;
    this.live.length = w;
  }
}
