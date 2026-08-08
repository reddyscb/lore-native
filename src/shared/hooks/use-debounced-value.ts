import { useEffect, useState } from 'react';

/**
 * Debounces `value`, and also reports whether a debounce is currently
 * pending — so a caller can show a loading spinner immediately on input
 * rather than waiting for the debounce to elapse (see Phase 6's Explore-tab
 * perf fix, which this hook generalizes).
 */
export function useDebouncedValue<T>(value: T, delayMs: number): [T, boolean] {
  const [debounced, setDebounced] = useState(value);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setIsPending(true);
    const timeout = setTimeout(() => {
      setDebounced(value);
      setIsPending(false);
    }, delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return [debounced, isPending];
}
