/** A key or a gamepad glyph. `pad` renders a round glyph (A/B/X/Y) or a text pill (LT, RT, START). */
export function Keycap({ label, pad }: { label: string; pad?: boolean }) {
  return <kbd className={`keycap${pad ? ' pad' : ''}`}>{label}</kbd>;
}
