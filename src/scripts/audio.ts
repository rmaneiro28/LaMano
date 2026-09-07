// Efectos de sonido sintetizados con Web Audio API
let audioCtx: AudioContext | null = null;
let isMuted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function initSoundSettings(): boolean {
  if (typeof window === 'undefined') return false;
  isMuted = localStorage.getItem('lamano_muted') === 'true';
  return isMuted;
}

export function toggleMute(): boolean {
  isMuted = !isMuted;
  if (typeof window !== 'undefined') {
    localStorage.setItem('lamano_muted', String(isMuted));
  }
  return isMuted;
}

export function isAudioMuted(): boolean {
  return isMuted;
}

export function playTap(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.05);

  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

export function playDominoSlam(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  // Sonido tipo golpe de ficha en mesa de madera + acorde
  const now = ctx.currentTime;

  // Impacto
  const oscLow = ctx.createOscillator();
  const gainLow = ctx.createGain();
  oscLow.type = 'triangle';
  oscLow.frequency.setValueAtTime(160, now);
  oscLow.frequency.exponentialRampToValueAtTime(40, now + 0.12);
  gainLow.gain.setValueAtTime(0.3, now);
  gainLow.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  oscLow.connect(gainLow);
  gainLow.connect(ctx.destination);
  oscLow.start();
  oscLow.stop(now + 0.12);

  // Acorde agradable
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + 0.04 * i);
    gain.gain.setValueAtTime(0.12, now + 0.04 * i);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + 0.04 * i);
    osc.stop(now + 0.4);
  });
}

export function playUndo(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(250, now + 0.15);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(now + 0.15);
}

export function playVictory(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 523.25, dur: 0.12, time: 0 },
    { freq: 659.25, dur: 0.12, time: 0.12 },
    { freq: 783.99, dur: 0.15, time: 0.24 },
    { freq: 1046.5, dur: 0.5, time: 0.39 },
  ];

  notes.forEach((n) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(n.freq, now + n.time);
    gain.gain.setValueAtTime(0.2, now + n.time);
    gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + n.time);
    osc.stop(now + n.time + n.dur);
  });
}

let currentPhraseAudio: HTMLAudioElement | null = null;

/**
 * Reproduce un audio real según los puntos obtenidos en la mano
 */
export function playPhrase(points: number, isGameOver: boolean = false): string | null {
  if (isMuted) return null;
  if (typeof window === 'undefined') return null;

  let phrases: { text: string; file: string }[] = [];

  if (isGameOver) {
    phrases = [
      { text: 'Pa la mierdaaa, dos más', file: '/Audios/100+ Pa la mierda dos mas.ogg' },
      { text: 'Dos más que diviertan', file: '/Audios/100+ Dos más que diviertan.ogg' }
    ];
  } else if (points >= 0 && points <= 29) {
    phrases = [
      { text: 'Marruñeco, agarra tu gallo muerto', file: '/Audios/0-29 Marruñeco, agarra tu gallo muerto.ogg' },
      { text: 'Cojeloo', file: '/Audios/0-29 Cogelooo.ogg' },
      { text: 'Y porque no trancaste, JEJEJEJEJE', file: '/Audios/0-29 Y porque no trancaste.ogg' }
    ];
  } else if (points >= 30 && points <= 40) {
    phrases = [
      { text: 'Coje tu yuca José Mapuey', file: '/Audios/30-40 Coge tu Yuca Jose Mapuey.ogg' },
      { text: '¡Ay paíto!', file: '/Audios/30-40 Ay Paito.ogg' },
      { text: 'Er Diablo', file: '/Audios/30-40 Er Diabloo.ogg' },
      { text: '¡Agarra ahii, trampolin de buche e verga!', file: '/Audios/30-40 ¡Agarra ahii, trampolin de buche e verga!.ogg' }
    ];
  } else if (points >= 41) {
    phrases = [
      { text: 'Esto se jodió', file: '/Audios/41-60 Esto se jodio.ogg' },
      { text: 'Vayan preparandose los otros dos', file: '/Audios/41-60 Vayan preparandose los otros dos.ogg' },
      { text: 'Recoge los vidrios', file: '/Audios/41-60 Recoge los vidrios.ogg' },
      { text: 'Esto se lo llevó quien lo trajo', file: '/Audios/41-60 Esto se lo llevó quien lo trajo.ogg' }
    ];
  }

  if (phrases.length === 0) return null;

  const phrase = phrases[Math.floor(Math.random() * phrases.length)];
  
  // Detener audio anterior si sigue sonando
  if (currentPhraseAudio) {
    currentPhraseAudio.pause();
    currentPhraseAudio.currentTime = 0;
  }
  
  currentPhraseAudio = new Audio(phrase.file);
  currentPhraseAudio.play().catch(e => console.error("Error reproduciendo audio de frase:", e));
  
  return phrase.text;
}

export function playWakeWordDetected(): void {
  if (isMuted) return;
  
  if (currentPhraseAudio) {
    currentPhraseAudio.pause();
    currentPhraseAudio.currentTime = 0;
  }

  currentPhraseAudio = new Audio('/Audios/Que juee.ogg');
  currentPhraseAudio.play().catch(e => console.error("Error reproduciendo audio de wake word:", e));
}

export function speakText(text: string): void {
  if (isMuted) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  
  // Cancelar audios hablados previos
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-VE'; // o es-ES
  utterance.rate = 1.1; // Un poco más rápido para que no sea tedioso
  
  window.speechSynthesis.speak(utterance);
}
