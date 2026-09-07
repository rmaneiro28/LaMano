export type VoiceIntent = 
  | { type: 'score', points: number, team: 'teamA' | 'teamB' }
  | { type: 'starter', team: 'teamA' | 'teamB' }
  | { type: 'names', teamA: string[], teamB: string[] };

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
    // Excluir si la frase parece ser de nombres ("salimos rubel y cesar") 
    // a menos que sea muy corta o explícita. Para proteger el registro de nombres, verificamos si hay muchos nombres.
    if (!/\b(contra|ellos)\b/.test(normalized) || normalized.split(' ').length <= 6) {
      return { type: 'starter', team };
    }
  }

  // --- DETECCIÓN DE NOMBRES ---
  // Si menciona "nombres", "jugando con", o divide claramente la frase ("contra", "ellos son")
  if (/\b(contra|ellos son|y ellos|y contra|versus|vs)\b/.test(normalized) && normalized.includes(' y ')) {
    let parts = normalized.split(/\b(contra|ellos son|y ellos|y contra|versus|vs)\b/);
    if (parts.length >= 3) {
      let left = parts[0];
      let right = parts.slice(2).join(' ');
      
      const extractNames = (text: string) => {
        const fillers = new Set([
          'yo', 'estoy', 'jugando', 'con', 'voy', 'vamos', 'nosotros', 'somos', 
          'el', 'la', 'los', 'las', 'un', 'una', 'anota', 'nombres', 'nombre', 
          'mi', 'equipo', 'y', 'van', 'son', 'se', 'llaman', 'wicho', 'guicho', 
          'we', 'show', 'a', 'de', 'que', 'en', 'para', 'aca', 'alla', 'aqui', 
          'estamos', 'ellos', 'contra', 'otros', 'los', 'las', 'mis', 'sus',
          'compañero', 'rivales', 'contrarios'
        ]);
        const words = text.split(/\s+/);
        // Filtrar palabras vacías o muy cortas
        return words
          .filter(w => w.length > 2 && !fillers.has(w))
          .map(w => w.charAt(0).toUpperCase() + w.slice(1));
      };
      
      const namesA = extractNames(left);
      const namesB = extractNames(right);
      
      // Necesitamos al menos 1 nombre por equipo (idealmente 2) para considerar que es un intent de nombres válido
      if (namesA.length >= 1 && namesB.length >= 1) {
        // Rellenar con genéricos si solo se entendió 1 nombre
        while (namesA.length < 2) namesA.push(`Jugador A${namesA.length + 1}`);
        while (namesB.length < 2) namesB.push(`Jugador B${namesB.length + 1}`);
        
        return { type: 'names', teamA: namesA.slice(0, 2), teamB: namesB.slice(0, 2) };
      }
    }
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
