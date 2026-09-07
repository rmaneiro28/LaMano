import { parseVoiceIntent, type VoiceIntent } from './nlp-parser';

let recognition: any = null;
let isListening = false;
let onIntentCallback: ((intent: VoiceIntent, originalText: string) => void) | null = null;
let onWakeWordDetectedCallback: (() => void) | null = null;
let onStateChangeCallback: ((active: boolean) => void) | null = null;
let restartTimeout: number | null = null;
let wakeWordDetectedThisPhrase = false;
let lastProcessedResultIndex = 0;

export function initVoiceAssistant(
  onIntent: (intent: VoiceIntent, text: string) => void,
  onWakeWord: () => void,
  onStateChange?: (active: boolean) => void
) {
  onIntentCallback = onIntent;
  onWakeWordDetectedCallback = onWakeWord;
  if (onStateChange) onStateChangeCallback = onStateChange;
  
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Speech Recognition API no soportada en este navegador.");
    return false;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'es-ES'; // Castellano

  recognition.onstart = () => {
    lastProcessedResultIndex = 0; // Reiniciar el índice de resultados en cada sesión
  };

  recognition.onresult = (event: any) => {
    for (let i = Math.max(event.resultIndex, lastProcessedResultIndex); i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript.trim().toLowerCase();
      // Regex más estricto con límites de palabra para no dispararse con ruido de fondo
      const hasWakeWord = /\b(wicho|guicho|güicho|huicho|wuicho|we show)\b/i.test(transcript);

      if (event.results[i].isFinal) {
        console.log("🗣️ Wicho escuchó (Final):", transcript);
        wakeWordDetectedThisPhrase = false; // Resetear para la siguiente frase
        lastProcessedResultIndex = i + 1; // Evitar procesar este resultado de nuevo
        if (hasWakeWord) {
          const intent = parseVoiceIntent(transcript);
          if (intent && onIntentCallback) {
            onIntentCallback(intent, transcript);
          }
        }
      } else {
        // Resultados parciales (mientras habla)
        if (hasWakeWord && !wakeWordDetectedThisPhrase) {
          wakeWordDetectedThisPhrase = true;
          if (onWakeWordDetectedCallback) {
            // Ya no llamaremos al audio desde aquí para evitar el corte en Android
            onWakeWordDetectedCallback();
          }
        }
      }
    }
  };

  recognition.onerror = (event: any) => {
    console.error("Voice Error:", event.error);
    if (event.error === 'not-allowed') {
      isListening = false;
      if (onStateChangeCallback) onStateChangeCallback(false);
    }
  };

  const tryRestart = () => {
    if (!isListening) return;
    try {
      recognition.start();
    } catch (e) {
      console.warn("Fallo al reiniciar mic, reintentando...", e);
      restartTimeout = window.setTimeout(tryRestart, 1000);
    }
  };

  recognition.onend = () => {
    if (isListening) {
      // Auto-restart persistente para mantener la escucha
      restartTimeout = window.setTimeout(tryRestart, 500);
    } else {
      if (onStateChangeCallback) onStateChangeCallback(false);
    }
  };

  return true;
}

export function toggleVoiceAssistant(): boolean {
  if (!recognition) return false;

  if (isListening) {
    isListening = false;
    if (restartTimeout) clearTimeout(restartTimeout);
    recognition.stop();
  } else {
    isListening = true;
    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      isListening = false;
    }
  }

  if (onStateChangeCallback) onStateChangeCallback(isListening);
  return isListening;
}

export function pauseVoiceAssistant(): void {
  if (recognition && isListening) {
    recognition.stop();
  }
}

export function resumeVoiceAssistant(): void {
  if (recognition && isListening) {
    try {
      recognition.start();
    } catch (e) {
      // Ignorar error si ya estaba corriendo
    }
  }
}

export function isAssistantListening(): boolean {
  return isListening;
}
