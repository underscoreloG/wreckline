import { describe, expect, it } from 'vitest';
import { firstEnabled, moveFocus } from './menuFocus';

const list = (disabled: boolean[]) => ({ disabled, columns: 1 });

describe('moveFocus, vertical list', () => {
  it('moves up and down', () => {
    const l = list([false, false, false]);
    expect(moveFocus(0, 'down', l)).toBe(1);
    expect(moveFocus(2, 'up', l)).toBe(1);
  });
  it('does not wrap', () => {
    const l = list([false, false, false]);
    expect(moveFocus(2, 'down', l)).toBe(2);
    expect(moveFocus(0, 'up', l)).toBe(0);
  });
  it('skips disabled items', () => {
    // Title menu: QUICK RACE, CAREER (disabled), CONTROLS, SETTINGS.
    const l = list([false, true, false, false]);
    expect(moveFocus(0, 'down', l)).toBe(2);
    expect(moveFocus(2, 'up', l)).toBe(0);
  });
  it('stays put when only disabled items remain in that direction', () => {
    expect(moveFocus(0, 'down', list([false, true, true]))).toBe(0);
  });
  it('ignores left and right', () => {
    const l = list([false, false]);
    expect(moveFocus(1, 'left', l)).toBe(1);
    expect(moveFocus(0, 'right', l)).toBe(0);
  });
  it('down x3 from the top of the title menu ends on SETTINGS', () => {
    const l = list([false, true, false, false]);
    let i = firstEnabled(l);
    for (let k = 0; k < 3; k++) i = moveFocus(i, 'down', l);
    expect(i).toBe(3);
  });
});

describe('moveFocus, grid', () => {
  // 3 columns x 2 rows
  const g = { disabled: [false, false, false, false, true, false], columns: 3 };
  it('moves within a row without leaving it', () => {
    expect(moveFocus(0, 'right', g)).toBe(1);
    expect(moveFocus(2, 'right', g)).toBe(2);
    expect(moveFocus(3, 'left', g)).toBe(3);
  });
  it('skips a disabled cell horizontally', () => {
    expect(moveFocus(3, 'right', g)).toBe(5);
    expect(moveFocus(5, 'left', g)).toBe(3);
  });
  it('moves by rows vertically', () => {
    expect(moveFocus(0, 'down', g)).toBe(3);
    expect(moveFocus(5, 'up', g)).toBe(2);
    expect(moveFocus(1, 'down', g)).toBe(1);
  });
});

describe('firstEnabled', () => {
  it('returns the first enabled index', () => {
    expect(firstEnabled(list([true, false, false]))).toBe(1);
    expect(firstEnabled(list([true, true]))).toBe(0);
  });
});
