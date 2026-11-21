// Sprachausgabe über die Web Speech API (im Browser eingebaut, keine Audiodateien nötig).

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakJapanese(text: string): void {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-').startsWith('ja'));
  if (voice) u.voice = voice;
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}
