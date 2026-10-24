import { createRoot } from 'react-dom/client';

/** STUB (WP00), WP04 replaces the body and keeps the signature. */
export function mountUiHarness(root: HTMLElement): void {
  createRoot(root).render(<div style={{ color: '#e8e8e8', font: '16px monospace', padding: 16 }}>WP04 pending</div>);
}
