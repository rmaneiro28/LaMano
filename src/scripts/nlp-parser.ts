export type VoiceIntent = 
  | { type: 'score', points: number, team: 'teamA' | 'teamB' }
  | { type: 'starter', team: 'teamA' | 'teamB' };

export function parseVoiceIntent(text: string): VoiceIntent | null {
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Encontrar el equipo
  let team: 'teamA' | 'teamB' | null = null;
  if (/\b(nosotros|aca|aqui|nuestro|nuestros|mi equipo|pa ca)\b/.test(normalized)) {
    team = 'teamA';
  } else if (/\b(ellos|alla|los otros|su equipo|contrarios|pa alla)\b/.test(normalized)) {
    team = 'teamB';
  }

  if (!team) return null;

  // Si dice "salió" o "salimos" es un registro de salida
  if (/\b(salio|sali|salimos|salen|sale)\b/.test(normalized)) {
    return { type: 'starter', team };
  }

  // Encontrar puntos (buscar dígitos primero)
  const digitMatch = normalized.match(/\b(\d+)\b/);
  let points = 0;
  if (digitMatch) {
    points = parseInt(digitMatch[1], 10);
  } else {
    // Si la API dictó los números en palabras
    const words: Record<string, number> = {
      'cero': 0, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
      'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
      'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15,
      'dieciseis': 16, 'diecisiete': 17, 'dieciocho': 18, 'diecinueve': 19,
      'veinte': 20, 'veintiuno': 21, 'veintidos': 22, 'veintitres': 23, 'veinticuatro': 24,
      'veinticinco': 25, 'veintiseis': 26, 'veintisiete': 27, 'veintiocho': 28, 'veintinueve': 29,
      'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60,
      'setenta': 70, 'ochenta': 80, 'noventa': 90, 'cien': 100
    };
    
    // Tratamos de buscar de mayor a menor longitud
    for (const [word, val] of Object.entries(words)) {
      if (new RegExp(`\\b${word}\\b`).test(normalized)) {
        points = val;
        break;
      }
    }
  }

  if (points > 0 && points <= 300) {
    return { type: 'score', points, team };
  }

  return null;
}
