// Control de Wake Lock para mantener la pantalla activa en mesa de dominó
let wakeLockSentinel: WakeLockSentinel | null = null;
let isRequested = false;

export async function requestWakeLock(): Promise<boolean> {
  if (typeof window === 'undefined' || !('wakeLock' in navigator)) {
    return false;
  }

  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    isRequested = true;

    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
    });

    return true;
  } catch (err) {
    console.warn('Wake Lock no pudo ser adquirido:', err);
    return false;
  }
}

export async function releaseWakeLock(): Promise<void> {
  isRequested = false;
  if (wakeLockSentinel) {
    await wakeLockSentinel.release();
    wakeLockSentinel = null;
  }
}

export function initWakeLock(): void {
  if (typeof document === 'undefined') return;

  // Reactivar wake lock si el usuario vuelve de otra app o desbloquea pantalla
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && isRequested && !wakeLockSentinel) {
      await requestWakeLock();
    }
  });
}
