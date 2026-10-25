import { useEffect, useState } from 'react';
import type { UiState } from '../../../shared/contracts';

const SHOW_MS = 2600;

/** One short message at the bottom (shop refusals, save errors); each new toast id restarts the timer. */
export function Toast({ toast }: { toast: UiState['toast'] }) {
  const [hidden, setHidden] = useState<number | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setHidden(toast.id), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [toast]);
  if (!toast || hidden === toast.id) return null;
  return (
    <div key={toast.id} className={`toast ${toast.kind}`} role="status">
      {toast.text}
    </div>
  );
}
