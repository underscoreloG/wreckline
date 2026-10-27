import { describe, expect, it } from 'vitest';
import { formatDelta } from './TimeTrialInfo';

describe('formatDelta', () => {
  it('signs the gap in hundredths: + slower, - faster', () => {
    expect(formatDelta(0.4249)).toBe('+0.42');
    expect(formatDelta(-0.31)).toBe('-0.31');
    expect(formatDelta(12.345)).toBe('+12.35');
    expect(formatDelta(0.004)).toBe('±0.00');
    expect(formatDelta(-0.004)).toBe('±0.00');
  });
});
