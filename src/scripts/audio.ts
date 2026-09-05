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
