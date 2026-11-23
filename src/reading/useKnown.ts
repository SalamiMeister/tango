// Live-Menge der bekannten Wörter (für Bekanntheitsquote und Markierung in Texten).

import { useMemo, useState } from 'react';
import { useReviews, useWords } from '../hooks';
import { getPref, setPref } from '../lib/localPrefs';
import { buildKnownSet } from './readingCore';

export function useKnownSet() {
  const words = useWords();
  const reviews = useReviews();
  const [includeUnlearned, setIncludeState] = useState(() => getPref('readIncludeUnlearned', false));
  const known = useMemo(
    () => (words && reviews ? buildKnownSet(words, reviews, includeUnlearned) : null),
    [words, reviews, includeUnlearned],
  );
  const setIncludeUnlearned = (v: boolean) => {
    setPref('readIncludeUnlearned', v);
    setIncludeState(v);
  };
  return { known, words, includeUnlearned, setIncludeUnlearned };
}
