// expert.ts
// Lógica para el Experto en Dominó Interactivo usando Groq API (Whisper + Llama3) via endpoints internos

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let isRecording = false;
let isProcessing = false;

export function initExpert(micButtonId: string) {
  const micBtn = document.getElementById(micButtonId);
  if (!micBtn) return;

  micBtn.addEventListener('mousedown', startRecording);
  micBtn.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Evitar doble evento
    startRecording();
  }, { passive: false });

  micBtn.addEventListener('mouseup', stopRecording);
  micBtn.addEventListener('mouseleave', () => {
    if (isRecording) stopRecording();
  });
  micBtn.addEventListener('touchend', stopRecording);
}

async function startRecording() {
  if (isRecording || isProcessing) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.addEventListener('dataavailable', event => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener('stop', processAudio);

    mediaRecorder.start();
    isRecording = true;
    showExpertToast('🎙️ Escuchando...', 'active');
    
    // Feedback visual en el botón
    const btn = document.getElementById('btn-expert-mic');
    if (btn) {
      btn.classList.add('active');
      btn.style.boxShadow = '0 0 15px rgba(251, 191, 36, 0.8)';
    }

  } catch (error) {
    console.error('Error al acceder al micrófono:', error);
    showExpertToast('❌ Error de micrófono', 'error');
  }
}

async function stopRecording() {
  if (!isRecording || !mediaRecorder) return;
  
  mediaRecorder.stop();
  isRecording = false;

  mediaRecorder.stream.getTracks().forEach(track => track.stop());

  const btn = document.getElementById('btn-expert-mic');
  if (btn) {
    btn.classList.remove('active');
    btn.style.boxShadow = '';
  }
}

async function processAudio() {
  if (audioChunks.length === 0) return;
  isProcessing = true;
  showExpertToast('🤔 Pensando...', 'processing');

  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

  try {
    // 1. Transcripción (Whisper)
    const transcription = await transcribeAudio(audioBlob);
    if (!transcription || transcription.trim().length === 0) {
      showExpertToast('No entendí lo que dijiste.', 'error');
      isProcessing = false;
      return;
    }

    showExpertToast(`🗣️ "${transcription}"`, 'processing');

    // 2. Chat Completions (Llama 3)
    const answer = await getExpertAnswer(transcription);
    
    // 3. Hablar la respuesta
    showExpertToast(answer, 'success', 8000);
    speakAnswer(answer);

  } catch (err) {
    console.error('Error procesando experto:', err);
    showExpertToast('❌ Hubo un error de conexión', 'error');
  } finally {
    isProcessing = false;
  }
}

async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');

  const res = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Transcribe API error: ${err.error || res.statusText}`);
  }

  const data = await res.json();
  return data.text;
}

async function getExpertAnswer(question: string): Promise<string> {
  const res = await fetch('/api/expert', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ question })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Expert API error: ${err.error || res.statusText}`);
  }

  const data = await res.json();
  return data.answer;
}

function speakAnswer(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-VE'; 
  utterance.rate = 1.05; 
  utterance.pitch = 0.95;
  
  window.speechSynthesis.speak(utterance);
}

let toastTimeout: number | null = null;
function showExpertToast(message: string, type: 'active' | 'processing' | 'success' | 'error', durationMs = 3000) {
  let toast = document.getElementById('expert-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'expert-toast';
    toast.style.position = 'fixed';
    toast.style.top = '70px'; 
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.fontWeight = 'bold';
    toast.style.zIndex = '99999';
    toast.style.boxShadow = '0 4px 15px rgba(0,0,0,0.4)';
    toast.style.textAlign = 'center';
    toast.style.transition = 'opacity 0.3s ease';
    toast.style.maxWidth = '90%';
    toast.style.fontSize = '0.9rem';
    document.body.appendChild(toast);
  }

  if (type === 'active') {
    toast.style.backgroundColor = 'rgba(239, 68, 68, 0.95)';
    toast.style.color = '#fff';
  } else if (type === 'processing') {
    toast.style.backgroundColor = 'rgba(59, 130, 246, 0.95)';
    toast.style.color = '#fff';
  } else if (type === 'error') {
    toast.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    toast.style.color = '#ef4444';
  } else {
    toast.style.backgroundColor = 'rgba(251, 191, 36, 0.95)';
    toast.style.color = '#000';
  }

  toast.textContent = message;
  toast.style.opacity = '1';

  if (toastTimeout) clearTimeout(toastTimeout);
  
  if (type !== 'active') {
    toastTimeout = window.setTimeout(() => {
      if (toast) toast.style.opacity = '0';
    }, durationMs) as unknown as number;
  }
}
