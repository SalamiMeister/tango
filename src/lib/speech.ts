// Sprachausgabe über die Web Speech API (im Browser eingebaut, keine Audiodateien nötig).

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function japaneseVoice(): SpeechSynthesisVoice | undefined {
  return window.speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ja'));
}

export function speakJapanese(text: string): void {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  const voice = japaneseVoice();
  if (voice) u.voice = voice;
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

/**
 * Gibt es eine japanische Stimme? Die Stimmenliste wird von manchen Browsern
 * erst verzögert geladen, daher bis zu 1,5 s warten.
 */
export function hasJapaneseVoice(): Promise<boolean> {
  if (!canSpeak()) return Promise.resolve(false);
  if (japaneseVoice()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = () => resolve(!!japaneseVoice());
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}
