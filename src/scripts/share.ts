import { loadGameState } from './game-store';

export async function shareToWhatsApp(): Promise<void> {
  const state = loadGameState();
  if (!state.isFinished) return;

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Fondo
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Bordes / Decoración
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 15;
  ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

  // Título
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 80px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("WICHO'S DOMINO CLUB", canvas.width / 2, 180);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '50px sans-serif';
  ctx.fillText("Resultado de la Partida", canvas.width / 2, 260);

  // Puntajes
  const teamA = state.teams.teamA.name;
  const teamB = state.teams.teamB.name;
  const scoreA = state.scoreTeamA;
  const scoreB = state.scoreTeamB;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 120px sans-serif';
  
  // Equipo A
  ctx.fillText(scoreA.toString(), canvas.width / 4, 550);
  ctx.font = '50px sans-serif';
  ctx.fillText(teamA, canvas.width / 4, 630);

  // VS
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 80px sans-serif';
  ctx.fillText("VS", canvas.width / 2, 550);

  // Equipo B
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 120px sans-serif';
  ctx.fillText(scoreB.toString(), (canvas.width / 4) * 3, 550);
  ctx.font = '50px sans-serif';
  ctx.fillText(teamB, (canvas.width / 4) * 3, 630);

  // Campeón
  const winner = scoreA > scoreB ? teamA : teamB;
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 70px sans-serif';
  ctx.fillText(`🏆 ¡${winner} Campeón! 🏆`, canvas.width / 2, 850);

  // Convertir a blob
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], 'wichos-partida.png', { type: 'image/png' });
    
    // Preparar texto de WhatsApp
    const text = `¡Partida finalizada en Wicho's Domino Club!\n\n🏆 ${winner} ganó la partida.\n\nMarcador final:\n${teamA}: ${scoreA}\n${teamB}: ${scoreB}`;

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: "Resultado de Dominó",
          text: text,
          files: [file]
        });
      } catch (e) {
        console.error("Error al compartir:", e);
      }
    } else {
      // Fallback: descargar imagen o mostrar alerta
      alert("Tu navegador no soporta compartir imágenes directo a WhatsApp. Mantén presionada la imagen que se abrirá para compartirla.");
      const url = URL.createObjectURL(blob);
      const win = window.open();
      if (win) {
         win.document.write(`<img src="${url}" style="width:100%;max-width:500px;"/>`);
      }
    }
  }, 'image/png');
}
