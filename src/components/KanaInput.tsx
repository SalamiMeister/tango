// Eingabefeld, das Romaji während des Tippens in Kana umwandelt (WanaKana).
// „taberu“ → たべる, „TEREBI“ → テレビ. Mit japanischer Tastatur getippte Kana bleiben, wie sie sind.

import { forwardRef, useRef, type InputHTMLAttributes } from 'react';
import { romajiToKana } from '../lib/text';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

export const KanaInput = forwardRef<HTMLInputElement, Props>(function KanaInput({ value, onChange, ...rest }, ref) {
  // Während eine Handy-Tastatur/IME noch „zusammensetzt“, nicht umwandeln – sonst gibt es Buchstabensalat.
  const composing = useRef(false);

  return (
    <input
      {...rest}
      ref={ref}
      value={value}
      lang="ja"
      autoCapitalize="off"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      onCompositionStart={() => (composing.current = true)}
      onCompositionEnd={(e) => {
        composing.current = false;
        onChange(romajiToKana(e.currentTarget.value, true));
      }}
      onChange={(e) => {
        const v = e.target.value;
        onChange(composing.current ? v : romajiToKana(v, true));
      }}
      onBlur={(e) => {
        // Beim Verlassen auch ein einzelnes „n“ am Ende umwandeln
        onChange(romajiToKana(e.target.value, false));
        rest.onBlur?.(e);
      }}
    />
  );
});
