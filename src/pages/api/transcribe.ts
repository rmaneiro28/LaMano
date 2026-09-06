import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    // En Astro con SSR, las variables del .env (sin VITE_) están en import.meta.env o process.env
    const apiKey = import.meta.env.GROQ_API_KEY || process.env.GROQ_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API Key no configurada en el servidor' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'es');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!res.ok) {
      throw new Error(`Whisper API error: ${res.statusText}`);
    }

    const data = await res.json();
    
    return new Response(JSON.stringify({ text: data.text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error en /api/transcribe:', error);
    return new Response(JSON.stringify({ error: error.message || 'Error desconocido' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
