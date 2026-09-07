import { parseVoiceIntent, type VoiceIntent } from './nlp-parser';

let recognition: any = null;
let isListening = false;
let onIntentCallback: ((intent: VoiceIntent, originalText: string) => void) | null = null;
let onWakeWordDetectedCallback: (() => void) | null = null;
let onStateChangeCallback: ((active: boolean) => void) | null = null;
let restartTimeout: number | null = null;
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

  recognition.onresult = (event: any) => {
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript.trim().toLowerCase();
      // Usar regex para capturar variaciones fonéticas comunes de "Wicho" en Speech to Text
      const hasWakeWord = /(wicho|guicho|güicho|huicho|wuicho|vicho|bicho|we show|lucho|luicho|hucho)/i.test(transcript);

      if (event.results[i].isFinal) {
        console.log("🗣️ Wicho escuchó (Final):", transcript);
        if (hasWakeWord) {
          const intent = parseVoiceIntent(transcript);
          if (intent && onIntentCallback) {
            onIntentCallback(intent, transcript);
          }
        }
      } else {
        // Resultados parciales (mientras habla)
        if (hasWakeWord && onWakeWordDetectedCallback) {
          onWakeWordDetectedCallback();
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

  recognition.onend = () => {
    if (isListening) {
      // Auto-restart para mantener la escucha continua activa
      restartTimeout = window.setTimeout(() => {
        try {
          if (isListening) recognition.start();
        } catch (e) {
          console.error(e);
        }
      }, 500);
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

export function isAssistantListening(): boolean {
  return isListening;
}
