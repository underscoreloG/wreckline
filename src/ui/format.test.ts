import { describe, expect, it } from 'vitest';
import { formatKmh, formatTime, ordinal } from './format';

describe('formatTime', () => {
  it('formats m:ss.cc', () => {
    expect(formatTime(67.421)).toBe('1:07.42');
    expect(formatTime(0)).toBe('0:00.00');
    expect(formatTime(5.5)).toBe('0:05.50');
    expect(formatTime(600)).toBe('10:00.00');
  });
  it('truncates instead of rounding up to the next centisecond', () => {
    expect(formatTime(59.999)).toBe('0:59.99');
  });
  it('clamps negatives to zero', () => {
    expect(formatTime(-1)).toBe('0:00.00');
  });
});

describe('formatKmh', () => {
  it('rounds and drops the sign', () => {
    expect(formatKmh(142.6)).toBe('143');
    expect(formatKmh(-12.2)).toBe('12');
  });
});

describe('ordinal', () => {
  it('handles the teens and the 1/2/3 endings', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '101st',
      '111th',
    ]);
  });
});
