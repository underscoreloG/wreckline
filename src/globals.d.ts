declare const __APP_VERSION__: string;

interface Window {
  /** Dev and test hook set by every harness (shape is harness specific). */
  __harness?: unknown;
  /** Dev-only game handle (WP08). */
  __game?: unknown;
}
