// Ermöglicht, die Schnelleingabe von überall zu öffnen – auch vorausgefüllt
// (z. B. „Als Vokabel übernehmen“ in der Leseansicht).

import { createContext, useContext } from 'react';
import type { WordDraft } from '../types';

export const QuickAddContext = createContext<(initial?: Partial<WordDraft>) => void>(() => {});

export function useQuickAdd() {
  return useContext(QuickAddContext);
}
