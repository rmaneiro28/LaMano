import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const apiKey = import.meta.env.GROQ_API_KEY || process.env.GROQ_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API Key no configurada en el servidor' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!body.question) {
      return new Response(JSON.stringify({ error: 'Falta la pregunta' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = `Eres un árbitro y experto en dominó caribeño/margariteño de Venezuela.
Tu trabajo es responder dudas sobre reglas o resolver jugadas problemáticas de dominó.
Reglas clave:
- El juego es por parejas (2 vs 2), rotación antihoraria, hasta 100 puntos.
- Si hay una tranca, gana la pareja que sume menos puntos en sus fichas restantes.
Responde de forma MUY corta, concisa y directa (máximo 2 oraciones).
Usa algo de jerga venezolana o margariteña, pero que se entienda claro. No uses emojis en la respuesta hablada.`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: body.question }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    });

    if (!res.ok) {
      throw new Error(`Groq Chat API error: ${res.statusText}`);
    }

    const data = await res.json();
    const answer = data.choices[0].message.content;

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error en /api/expert:', error);
    return new Response(JSON.stringify({ error: error.message || 'Error desconocido' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
