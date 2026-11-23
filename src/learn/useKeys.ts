// Tastatur-Hook: ruft immer die AKTUELLE Funktion auf (über eine Ref),
// damit schnelle Tastendrücke nie einen veralteten Zustand sehen.

import { useEffect, useRef } from 'react';

export function useKeys(handler: (e: KeyboardEvent) => void, ignoreInInputs = true): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ignoreInInputs && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return;
      ref.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ignoreInInputs]);
}
