import { Keycap } from './Keycap';

// WP04 spec: the race hint row (pre-race, pause). Full bindings live on the CONTROLS screen.
const KEYBOARD: readonly [string, string][] = [
  ['S', 'FIRE'],
  ['D', 'MINE'],
  ['A', 'ROCKET FUEL'],
  ['SPACE', 'HANDBRAKE'],
  ['ESC', 'PAUSE'],
];
const GAMEPAD: readonly [string, string][] = [
  ['A', 'FIRE'],
  ['X', 'MINE'],
  ['Y', 'ROCKET FUEL'],
  ['B', 'HANDBRAKE'],
  ['START', 'PAUSE'],
];

export function KeyHints({ gamepad }: { gamepad: boolean }) {
  return (
    <div className="key-hints muted">
      {(gamepad ? GAMEPAD : KEYBOARD).map(([key, label]) => (
        <span className="key-hint" key={label}>
          <Keycap label={key} pad={gamepad} />
          {label}
        </span>
      ))}
    </div>
  );
}
