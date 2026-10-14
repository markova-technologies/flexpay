import { useEffect, useRef } from 'react';

/**
 * Polls a function at the given interval until stopCondition returns true.
 * @param {() => Promise<void>} fn - Async function to call
 * @param {number} intervalMs - Polling interval in milliseconds
 * @param {boolean} active - Set false to pause/stop polling
 */
export function usePolling(fn, intervalMs = 2000, active = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!active) return;
    let timeoutId;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        await fnRef.current();
      } catch {
        // Errors are handled inside fn
      }
      if (!cancelled) {
        timeoutId = setTimeout(tick, intervalMs);
      }
    };

    timeoutId = setTimeout(tick, intervalMs);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [intervalMs, active]);
}
