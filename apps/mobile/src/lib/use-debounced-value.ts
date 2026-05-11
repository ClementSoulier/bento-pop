import { useEffect, useState } from 'react';

/**
 * Retourne `value` après un délai de `delayMs` sans changement.
 * Utile pour ne pas déclencher de fetch à chaque keystroke d'une recherche.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
