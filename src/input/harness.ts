import type { InputFrame, UiNav } from '../shared/contracts';
import { createInputSource } from './index';

const NAV_LOG_SIZE = 20;

/** ?harness=input: live InputFrame readout, nav events log, gamepad id. Polls once per frame (the game polls once per sim tick). */
export function mountInputHarness(root: HTMLElement): void {
  root.style.cssText += ';color:#e8e8e8;font:15px/1.5 monospace;padding:16px;white-space:pre';
  const input = createInputSource(window);
  const navLog: { nav: UiNav; t: number }[] = [];
  input.onNav((nav) => {
    navLog.push({ nav, t: Math.round(performance.now()) });
    if (navLog.length > NAV_LOG_SIZE) navLog.shift();
    draw();
  });
  let last: InputFrame = input.poll();

  const fmt = (f: InputFrame): string =>
    Object.entries(f)
      .map(([k, v]) => `${k.padEnd(10)} ${typeof v === 'number' ? v.toFixed(3) : String(v)}`)
      .join('\n');
  const draw = (): void => {
    root.textContent = [
      'WP05 input harness - keys: arrows, S fire, D mine, A turbo, Space handbrake, Esc pause, Enter confirm',
      '',
      fmt(last),
      '',
      `usingGamepad ${input.usingGamepad()}`,
      `gamepad      ${input.gamepadId() ?? '(none)'}`,
      '',
      'nav events (latest last):',
      ...navLog.map((e) => `  ${String(e.t).padStart(8)} ms  ${e.nav}`),
    ].join('\n');
  };
  const poll = (): InputFrame => {
    last = { ...input.poll() };
    draw();
    return last;
  };
  const loop = (): void => {
    poll();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  draw();

  window.__harness = {
    input,
    /** One poll now (works while the pane is hidden and rAF is paused). */
    poll,
    last: () => last,
    navLog: () => navLog.map((e) => e.nav),
    usingGamepad: () => input.usingGamepad(),
    gamepadId: () => input.gamepadId(),
  };
}
