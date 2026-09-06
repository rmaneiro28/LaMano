import {
  loadGameState,
  recordHand,
  undoLastHand,
  rematchGame,
  setupNewMatch,
  startNextGame,
  setHandStarter,
  updateTeamName,
  updatePlayerName,
  STATE_CHANGE_EVENT,
  getTeamBySeat,
  getWinsNeeded,
} from './game-store';
import type { GameState, MatchMode, SeatIndex, TeamId, HandWinType } from './types';
import {
  initSoundSettings,
  toggleMute,
  isAudioMuted,
  playTap,
  playDominoSlam,
  playUndo,
  playVictory,
  playPhrase,
} from './audio';
import { initWakeLock, requestWakeLock, releaseWakeLock } from './wake-lock';

// ================= ESTADO LOCAL DE FORMULARIOS ================= //
let closeHandWinType: HandWinType = 'normal';
let closeHandWinnerSeat: SeatIndex | undefined = undefined;
let closeHandWinnerTeam: TeamId | undefined = undefined;
let closeHandPoints = 0;
let setupMatchMode: MatchMode = 'bo3';
let isWakeLockActive = false;
let pendingStarterSeat: SeatIndex | null = null; // Primer toque: asiento seleccionado pero sin confirmar

// Canvas de Confetti
let confettiAnimationId: number | null = null;

// ================= INICIALIZACIÓN ================= //
export function initApp(): void {
  // Inicializar sonido y wake lock
  const muted = initSoundSettings();
  updateAudioButton(muted);
  initWakeLock();

  // Escuchar cambios de estado
  window.addEventListener(STATE_CHANGE_EVENT, (e: Event) => {
    const customEvent = e as CustomEvent<GameState>;
    renderState(customEvent.detail);
  });

  // Setup de Listeners de la UI
  setupHeaderListeners();
  setupRoundControlsListeners();
  setupCloseHandModalListeners();
  setupHistoryDrawerListeners();
  setupSetupModalListeners();
  setupVictoryModalListeners();
  setupStarterConfirmListeners();

  // Render inicial
  const initialState = loadGameState();
  renderState(initialState);
}

// ================= HEADER CONTROLS ================= //
function setupHeaderListeners(): void {
  const btnWakeLock = document.getElementById('btn-wake-lock');
  const btnAudio = document.getElementById('btn-audio-toggle');
  const btnOpenSetup = document.getElementById('btn-open-setup');

  if (btnWakeLock) {
    btnWakeLock.addEventListener('click', async () => {
      playTap();
      if (!isWakeLockActive) {
        const acquired = await requestWakeLock();
        if (acquired) {
          isWakeLockActive = true;
          updateWakeLockButton(true);
        }
      } else {
        await releaseWakeLock();
        isWakeLockActive = false;
        updateWakeLockButton(false);
      }
    });
  }

  if (btnAudio) {
    btnAudio.addEventListener('click', () => {
      const isMutedNow = toggleMute();
      updateAudioButton(isMutedNow);
      if (!isMutedNow) playTap();
    });
  }

  if (btnOpenSetup) {
    btnOpenSetup.addEventListener('click', () => {
      playTap();
      openSetupModal();
    });
  }

  // initExpert('btn-expert-mic'); // Removed as it is not defined and causes ReferenceError
}

function updateWakeLockButton(active: boolean): void {
  const btn = document.getElementById('btn-wake-lock');
  const dot = document.getElementById('wake-lock-dot');
  if (btn && dot) {
    if (active) {
      btn.classList.add('active');
      dot.classList.add('active');
      btn.title = 'Pantalla siempre activa: ACTIVADA';
    } else {
      btn.classList.remove('active');
      dot.classList.remove('active');
      btn.title = 'Pantalla siempre activa: DESACTIVADA';
    }
  }
}

function updateAudioButton(muted: boolean): void {
  const icon = document.getElementById('audio-icon');
  if (icon) {
    icon.textContent = muted ? '🔇' : '🔊';
  }
}

// ================= RENDER DE ESTADO ================= //
function renderState(state: GameState): void {
  renderScoreBoard(state);
  renderDominoTable(state);
  renderRoundControls(state);
  renderHistoryDrawer(state);

  // Comprobar fin de partida
  if (state.isFinished && state.winnerTeam) {
    showVictoryModal(state);
  } else {
    closeVictoryModal();
  }
}

function renderScoreBoard(state: GameState): void {
  const nameA = document.getElementById('display-team-a-name');
  const nameB = document.getElementById('display-team-b-name');
  const scoreA = document.getElementById('score-team-a');
  const scoreB = document.getElementById('score-team-b');
  const progressA = document.getElementById('progress-team-a');
  const progressB = document.getElementById('progress-team-b');
  const targetDiffA = document.getElementById('target-diff-team-a');
  const targetDiffB = document.getElementById('target-diff-team-b');
  const roundDisplay = document.getElementById('display-current-round');
  const targetNumber = document.getElementById('display-target-number');
  const rowsContainer = document.getElementById('scoresheet-rows');
  const scrollArea = document.getElementById('scoresheet-scroll-area');

  if (nameA) {
    nameA.textContent = state.teams.teamA.name;
    nameA.title = 'Haz clic para editar nombre del equipo';
    nameA.style.cursor = 'pointer';
    nameA.onclick = () => {
      const newName = prompt('Ingrese el nuevo nombre para Nosotros (Equipo A):', state.teams.teamA.name);
      if (newName) updateTeamName('teamA', newName);
    };
  }
  if (nameB) {
    nameB.textContent = state.teams.teamB.name;
    nameB.title = 'Haz clic para editar nombre del equipo';
    nameB.style.cursor = 'pointer';
    nameB.onclick = () => {
      const newName = prompt('Ingrese el nuevo nombre para Ellos (Equipo B):', state.teams.teamB.name);
      if (newName) updateTeamName('teamB', newName);
    };
  }
  if (scoreA) scoreA.textContent = String(state.scoreTeamA);
  if (scoreB) scoreB.textContent = String(state.scoreTeamB);
  if (roundDisplay) roundDisplay.textContent = String(state.currentRound);
  if (targetNumber) targetNumber.textContent = String(state.settings.targetScore);

  const target = state.settings.targetScore;
  const pctA = Math.min(100, (state.scoreTeamA / target) * 100);
  const pctB = Math.min(100, (state.scoreTeamB / target) * 100);

  if (progressA) progressA.style.width = `${pctA}%`;
  if (progressB) progressB.style.width = `${pctB}%`;

  const remainingA = Math.max(0, target - state.scoreTeamA);
  const remainingB = Math.max(0, target - state.scoreTeamB);

  if (targetDiffA) targetDiffA.textContent = remainingA === 0 ? '¡Meta lograda!' : `Faltan ${remainingA}`;
  if (targetDiffB) targetDiffB.textContent = remainingB === 0 ? '¡Meta lograda!' : `Faltan ${remainingB}`;

  // Render de las partidas en dos columnas (Anotación Manual)
  if (rowsContainer) {
    if (state.history.length === 0) {
      rowsContainer.innerHTML = `
        <div class="scoresheet-empty-state" id="scoresheet-empty-state">
          <div class="empty-row-guide">
            <span class="empty-cell">—</span>
            <span class="empty-divider"></span>
            <span class="empty-cell">—</span>
          </div>
          <p class="empty-note">Anotación manual lista. Cierra la 1ª mano para registrar los puntos.</p>
        </div>
      `;
    } else {
      const rowsHtml = state.history
        .map((item, index) => {
          const isLatest = index === state.history.length - 1;
          const isTeamA = item.winningTeam === 'teamA';
          const trancaIcon = item.winType === 'tranca' ? '<span title="Victoria por tranca" style="font-size:0.75rem;margin:0 2px;">🔒</span>' : '';

          const cellA = isTeamA
            ? `<div class="score-value-tag">
                 <span class="score-points-a">+${item.points}</span>
                 <span class="score-sub-accum">(${item.scoreTeamAAfter})</span>
                 ${trancaIcon}
               </div>`
            : '<span class="score-dash">—</span>';

          const cellB = !isTeamA
            ? `<div class="score-value-tag">
                 ${trancaIcon}
                 <span class="score-sub-accum">(${item.scoreTeamBAfter})</span>
                 <span class="score-points-b">+${item.points}</span>
               </div>`
            : '<span class="score-dash">—</span>';

          return `
            <div class="scoresheet-row ${isLatest ? 'latest-round' : ''}">
              <div class="score-cell cell-team-a">${cellA}</div>
              <span class="row-round-badge">M${item.round}</span>
              <div class="score-cell cell-team-b">${cellB}</div>
            </div>
          `;
        })
        .join('');

      rowsContainer.innerHTML = rowsHtml;

      // Auto-scroll al final para mantener siempre visible la última mano anotada
      if (scrollArea) {
        requestAnimationFrame(() => {
          scrollArea.scrollTop = scrollArea.scrollHeight;
        });
      }
    }
  }

  // Render indicadores de serie en el scoreboard
  renderSeriesIndicator(state);
}

/** Renderiza los indicadores de partidas ganadas en la serie (pips) */
function renderSeriesIndicator(state: GameState): void {
  const indicatorA = document.getElementById('series-indicator-a');
  const indicatorB = document.getElementById('series-indicator-b');
  const seriesTag = document.getElementById('series-mode-tag');
  const numA = document.getElementById('series-score-num-a');
  const numB = document.getElementById('series-score-num-b');

  const winsNeeded = getWinsNeeded(state.matchMode);
  const modeLabel = state.matchMode === 'bo3' ? 'Bo3' : 'Bo5';

  if (seriesTag) {
    seriesTag.textContent = `${modeLabel} · P${state.gameNumber}`;
  }

  if (numA) numA.textContent = String(state.gamesWonTeamA);
  if (numB) numB.textContent = String(state.gamesWonTeamB);

  function buildPips(won: number, total: number, teamClass: string): string {
    let html = '';
    for (let i = 0; i < winsNeeded; i++) {
      html += `<span class="series-pip-mini ${i < won ? teamClass : ''}"></span>`;
    }
    return html;
  }

  if (indicatorA) indicatorA.innerHTML = buildPips(state.gamesWonTeamA, winsNeeded, 'won-a');
  if (indicatorB) indicatorB.innerHTML = buildPips(state.gamesWonTeamB, winsNeeded, 'won-b');
}

function renderDominoTable(state: GameState): void {
  // Si el salidor ya fue confirmado, ocultar banner de confirmación pendiente
  if (state.starterConfirmed) {
    hideStarterConfirmBanner();
  }

  // Render de cada jugador en su asiento
  state.players.forEach((player) => {
    const nameEl = document.getElementById(`seat-player-name-${player.seat}`);
    const teamEl = document.getElementById(`seat-player-team-${player.seat}`);
    const cardEl = document.getElementById(`seat-card-${player.seat}`);
    const badgeEl = document.getElementById(`hand-indicator-${player.seat}`);

    if (nameEl) {
      nameEl.textContent = player.name;
      nameEl.title = 'Haz clic para editar nombre del jugador';
      nameEl.style.cursor = 'pointer';
      nameEl.onclick = (e) => {
        e.stopPropagation();
        const newName = prompt(`Ingrese el nuevo nombre para el Asiento ${player.seat + 1}:`, player.name);
        if (newName) {
          updatePlayerName(player.seat, newName);
          renderState(loadGameState());
        }
      };
    }
    if (teamEl) {
      teamEl.textContent = player.team === 'teamA' ? state.teams.teamA.name : state.teams.teamB.name;
      teamEl.title = 'Haz clic para editar nombre del equipo';
      teamEl.style.cursor = 'pointer';
      teamEl.onclick = (e) => {
        e.stopPropagation();
        const newName = prompt(`Ingrese el nuevo nombre para ${player.team === 'teamA' ? 'Equipo A' : 'Equipo B'}:`, teamEl.textContent || '');
        if (newName) {
          updateTeamName(player.team, newName);
          renderState(loadGameState());
        }
      };
    }

    const isStarter = state.currentHandStarterSeat === player.seat;
    const isPending = !state.starterConfirmed && pendingStarterSeat === player.seat;

    if (cardEl) {
      if (!state.starterConfirmed) {
        // Solo en la primera mano: primer toque activa estado pendiente
        cardEl.style.cursor = 'pointer';
        cardEl.title = `Toca para seleccionar a ${player.name} como salidor`;
        cardEl.onclick = () => {
          playTap();
          // Si ya hay un pendiente diferente, limpiar su clase
          if (pendingStarterSeat !== null && pendingStarterSeat !== player.seat) {
            const prevCard = document.getElementById(`seat-card-${pendingStarterSeat}`);
            prevCard?.classList.remove('is-starter-pending');
          }
          pendingStarterSeat = player.seat;
          showStarterConfirmBanner(state, player.seat);
        };
      } else {
        // Ya confirmado: deshabilitar toque — la rotación es automática
        cardEl.style.cursor = 'default';
        cardEl.title = '';
        cardEl.onclick = null;
      }

      // Clase visual: pendiente (amarillo pulsante) o confirmado (azul)
      if (isPending) {
        cardEl.classList.add('is-starter-pending');
        cardEl.classList.remove('is-hand-starter');
      } else if (isStarter && state.starterConfirmed) {
        cardEl.classList.add('is-hand-starter');
        cardEl.classList.remove('is-starter-pending');
      } else {
        cardEl.classList.remove('is-hand-starter', 'is-starter-pending');
      }
    }

    if (badgeEl) {
      if (isStarter) {
        badgeEl.innerHTML = `
          <span class="badge badge-gold mano-badge">
            <span>✋</span>
            <span>LA MANO</span>
          </span>
        `;
      } else {
        badgeEl.innerHTML = '';
      }
    }
  });

  // Centro de mesa: siempre antihorario y rotación continua
  const rotationSymbol = document.getElementById('rotation-symbol');
  const rotationText = document.getElementById('rotation-text');
  const exitRuleBadge = document.getElementById('exit-rule-badge');

  if (rotationSymbol) rotationSymbol.textContent = '↺';
  if (rotationText) rotationText.textContent = 'Antihorario';
  if (exitRuleBadge) exitRuleBadge.textContent = 'Rotación Continua';

  // Banner contextual de salida
  const starterPlayer = state.players[state.currentHandStarterSeat];
  const starterName = document.getElementById('banner-starter-name');
  const starterTeam = document.getElementById('banner-starter-team');
  const captionEl = document.querySelector('.turn-caption');

  if (starterName && starterPlayer) {
    starterName.textContent = starterPlayer.name;
  }
  if (starterTeam && starterPlayer) {
    starterTeam.textContent = starterPlayer.team === 'teamA' ? state.teams.teamA.name : state.teams.teamB.name;
    starterTeam.className = `turn-team-badge ${starterPlayer.team === 'teamA' ? 'badge-team-a' : 'badge-team-b'}`;
  }

  if (captionEl) {
    if (!state.starterConfirmed) {
      captionEl.textContent = '✋ Toca al jugador para asignar la salida:';
    } else {
      captionEl.textContent = 'Tiene la salida:';
    }
  }
}

function renderRoundControls(state: GameState): void {
  const btnUndo = document.getElementById('btn-undo-hand') as HTMLButtonElement | null;
  const btnCloseHand = document.getElementById('btn-open-close-hand') as HTMLButtonElement | null;
  const historyBadge = document.getElementById('history-badge-count');

  if (btnUndo) {
    btnUndo.disabled = state.history.length === 0;
  }
  if (btnCloseHand) {
    btnCloseHand.disabled = state.isFinished || !state.starterConfirmed;
    if (!state.starterConfirmed) {
      btnCloseHand.title = 'Primero toca al jugador en la mesa para asignar la salida';
    } else {
      btnCloseHand.title = '';
    }
  }
  if (historyBadge) {
    historyBadge.textContent = String(state.history.length);
  }
}

// ================= MODAL CERRAR MANO ================= //
function setupRoundControlsListeners(): void {
  const btnOpenClose = document.getElementById('btn-open-close-hand');
  const btnUndo = document.getElementById('btn-undo-hand');
  const btnOpenHistory = document.getElementById('btn-open-history');

  if (btnOpenClose) {
    btnOpenClose.addEventListener('click', () => {
      playTap();
      openCloseHandModal();
    });
  }

  if (btnUndo) {
    btnUndo.addEventListener('click', () => {
      if (confirm('¿Deseas anular la última mano registrada y restaurar los puntos anteriores?')) {
        playUndo();
        undoLastHand();
      }
    });
  }

  if (btnOpenHistory) {
    btnOpenHistory.addEventListener('click', () => {
      playTap();
      openHistoryDrawer();
    });
  }
}

function openCloseHandModal(): void {
  const state = loadGameState();
  if (state.isFinished) return;
  if (!state.starterConfirmed) return; // No abrir si no se ha confirmado el salidor

  // Reset de valores locales
  closeHandWinType = 'normal';
  closeHandWinnerSeat = undefined;
  closeHandWinnerTeam = undefined;
  closeHandPoints = 0;

  // Actualizar título
  const subtitleRound = document.getElementById('modal-subtitle-round');
  if (subtitleRound) {
    subtitleRound.textContent = `Partida ${state.gameNumber} · Ronda ${state.currentRound} · Meta 100 pts`;
  }

  // Mostrar nombre del salidor actual
  const starterNameEl = document.getElementById('modal-current-starter-name');
  if (starterNameEl) {
    starterNameEl.textContent = state.players[state.currentHandStarterSeat]?.name || '—';
  }

  // Actualizar nombres de jugadores en el selector de ganador
  state.players.forEach((p) => {
    const nameEl = document.getElementById(`select-name-${p.seat}`);
    if (nameEl) nameEl.textContent = p.name;
  });

  const teamANameEl = document.getElementById('select-team-a-name');
  const teamBNameEl = document.getElementById('select-team-b-name');
  if (teamANameEl) teamANameEl.textContent = state.teams.teamA.name;
  if (teamBNameEl) teamBNameEl.textContent = state.teams.teamB.name;

  updateCloseHandTypeUI();
  updateCloseHandPointsDisplay();
  updateCloseHandPreview();

  const modal = document.getElementById('close-hand-modal');
  if (modal) modal.classList.add('active');
}

function closeCloseHandModal(): void {
  const modal = document.getElementById('close-hand-modal');
  if (modal) modal.classList.remove('active');
}

function setupCloseHandModalListeners(): void {
  const btnCancel = document.getElementById('btn-cancel-close-hand');
  const btnWinNormal = document.getElementById('btn-win-normal');
  const btnWinTranca = document.getElementById('btn-win-tranca');
  const btnSubmit = document.getElementById('btn-submit-hand');

  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      playTap();
      closeCloseHandModal();
    });
  }

  if (btnWinNormal) {
    btnWinNormal.addEventListener('click', () => {
      playTap();
      closeHandWinType = 'normal';
      updateCloseHandTypeUI();
      updateCloseHandPreview();
    });
  }

  if (btnWinTranca) {
    btnWinTranca.addEventListener('click', () => {
      playTap();
      closeHandWinType = 'tranca';
      updateCloseHandTypeUI();
      updateCloseHandPreview();
    });
  }

  // Selector de Jugadores (Normal)
  for (let s = 0; s < 4; s++) {
    const btnSeat = document.getElementById(`btn-select-seat-${s}`);
    if (btnSeat) {
      btnSeat.addEventListener('click', () => {
        playTap();
        closeHandWinnerSeat = s as SeatIndex;
        closeHandWinnerTeam = getTeamBySeat(s as SeatIndex);

        // Actualizar visual de selección
        document.querySelectorAll('#section-winner-player .player-select-btn').forEach((b) => b.classList.remove('selected'));
        btnSeat.classList.add('selected');
        updateCloseHandPreview();
      });
    }
  }

  // Selector de Equipos (Tranca)
  const btnTeamA = document.getElementById('btn-select-team-a');
  const btnTeamB = document.getElementById('btn-select-team-b');

  if (btnTeamA) {
    btnTeamA.addEventListener('click', () => {
      playTap();
      closeHandWinnerTeam = 'teamA';
      btnTeamA.classList.add('selected');
      if (btnTeamB) btnTeamB.classList.remove('selected');
      updateCloseHandPreview();
    });
  }

  if (btnTeamB) {
    btnTeamB.addEventListener('click', () => {
      playTap();
      closeHandWinnerTeam = 'teamB';
      btnTeamB.classList.add('selected');
      if (btnTeamA) btnTeamA.classList.remove('selected');
      updateCloseHandPreview();
    });
  }

  // Keypad Numérico
  document.querySelectorAll('.keypad-btn[data-num]').forEach((btn) => {
    btn.addEventListener('click', () => {
      playTap();
      const num = (btn as HTMLElement).dataset.num || '0';
      if (closeHandPoints === 0) {
        closeHandPoints = parseInt(num, 10);
      } else {
        const nextVal = parseInt(`${closeHandPoints}${num}`, 10);
        if (nextVal <= 300) {
          closeHandPoints = nextVal;
        }
      }
      updateCloseHandPointsDisplay();
      updateCloseHandPreview();
    });
  });

  const btnClear = document.getElementById('btn-keypad-clear');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      playTap();
      closeHandPoints = 0;
      updateCloseHandPointsDisplay();
      updateCloseHandPreview();
    });
  }

  const btnBackspace = document.getElementById('btn-keypad-backspace');
  if (btnBackspace) {
    btnBackspace.addEventListener('click', () => {
      playTap();
      const str = String(closeHandPoints);
      if (str.length <= 1) {
        closeHandPoints = 0;
      } else {
        closeHandPoints = parseInt(str.slice(0, -1), 10);
      }
      updateCloseHandPointsDisplay();
      updateCloseHandPreview();
    });
  }

  // Chips rápidos de adición
  document.querySelectorAll('.quick-chip[data-add]').forEach((chip) => {
    chip.addEventListener('click', () => {
      playTap();
      const add = parseInt((chip as HTMLElement).dataset.add || '0', 10);
      closeHandPoints = Math.min(300, closeHandPoints + add);
      updateCloseHandPointsDisplay();
      updateCloseHandPreview();
    });
  });

  // Guardar Mano
  if (btnSubmit) {
    btnSubmit.addEventListener('click', () => {
      if (closeHandWinType === 'normal' && closeHandWinnerSeat === undefined) {
        alert('Por favor selecciona el jugador que dominó la mano.');
        return;
      }
      if (closeHandWinType === 'tranca' && !closeHandWinnerTeam) {
        alert('Por favor selecciona el equipo ganador del conteo.');
        return;
      }
      if (closeHandPoints <= 0) {
        alert('Por favor ingresa los puntos sumados en esta mano (mayor a 0).');
        return;
      }

      playDominoSlam();

      const phrase = playPhrase(closeHandPoints);
      if (phrase) {
        showPhraseToast(phrase);
      }

      recordHand(
        closeHandWinType,
        closeHandPoints,
        closeHandWinnerSeat,
        closeHandWinnerTeam,
        undefined // El salidor ya está en el estado, no se pasa desde el modal
      );

      closeCloseHandModal();
    });
  }
}

function showPhraseToast(phrase: string): void {
  let toast = document.getElementById('phrase-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'phrase-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = 'rgba(251, 191, 36, 0.9)';
    toast.style.color = '#000';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.fontWeight = 'bold';
    toast.style.zIndex = '99999';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    toast.style.textAlign = 'center';
    toast.style.transition = 'opacity 0.3s ease';
    document.body.appendChild(toast);
  }

  toast.textContent = phrase;
  toast.style.opacity = '1';

  setTimeout(() => {
    if (toast) toast.style.opacity = '0';
  }, 4000);
}

function updateCloseHandTypeUI(): void {
  const btnNormal = document.getElementById('btn-win-normal');
  const btnTranca = document.getElementById('btn-win-tranca');
  const secPlayer = document.getElementById('section-winner-player');
  const secTeam = document.getElementById('section-winner-team');

  if (closeHandWinType === 'normal') {
    btnNormal?.classList.add('active');
    btnTranca?.classList.remove('active');
    secPlayer?.classList.remove('hidden');
    secTeam?.classList.add('hidden');
  } else {
    btnNormal?.classList.remove('active');
    btnTranca?.classList.add('active');
    secPlayer?.classList.add('hidden');
    secTeam?.classList.remove('hidden');
  }

  // Reset selecciones
  document.querySelectorAll('.player-select-btn').forEach((b) => b.classList.remove('selected'));
  document.querySelectorAll('.team-select-btn').forEach((b) => b.classList.remove('selected'));
  closeHandWinnerSeat = undefined;
  closeHandWinnerTeam = undefined;
}

function updateCloseHandPointsDisplay(): void {
  const display = document.getElementById('input-points-display');
  if (display) {
    display.textContent = String(closeHandPoints);
  }
}

function updateCloseHandPreview(): void {
  const previewText = document.getElementById('preview-text');
  if (!previewText) return;

  const state = loadGameState();
  const starterName = state.players[state.currentHandStarterSeat]?.name || '?';

  if (closeHandWinType === 'normal' && closeHandWinnerSeat !== undefined) {
    const player = state.players[closeHandWinnerSeat];
    const team = player.team === 'teamA' ? state.teams.teamA : state.teams.teamB;
    const currentScore = player.team === 'teamA' ? state.scoreTeamA : state.scoreTeamB;
    const newScore = currentScore + closeHandPoints;

    previewText.innerHTML = `Salió <strong>${starterName}</strong>. <strong>${player.name}</strong> sumará <strong>+${closeHandPoints} pts</strong> a ${team.name} (Total: ${newScore}/100)`;
  } else if (closeHandWinType === 'tranca' && closeHandWinnerTeam) {
    const team = closeHandWinnerTeam === 'teamA' ? state.teams.teamA : state.teams.teamB;
    const currentScore = closeHandWinnerTeam === 'teamA' ? state.scoreTeamA : state.scoreTeamB;
    const newScore = currentScore + closeHandPoints;

    previewText.innerHTML = `Salió <strong>${starterName}</strong>. Tranca ganada por <strong>${team.name}</strong> con <strong>+${closeHandPoints} pts</strong> (Total: ${newScore}/100)`;
  } else {
    previewText.innerHTML = `Salió <strong>${starterName}</strong>. Selecciona quién ganó y anota los puntos.`;
  }
}

// ================= HISTORIAL DRAWER ================= //
function setupHistoryDrawerListeners(): void {
  const btnClose = document.getElementById('btn-close-history');
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      playTap();
      closeHistoryDrawer();
    });
  }
}

function openHistoryDrawer(): void {
  const modal = document.getElementById('history-drawer-modal');
  if (modal) modal.classList.add('active');
}

function closeHistoryDrawer(): void {
  const modal = document.getElementById('history-drawer-modal');
  if (modal) modal.classList.remove('active');
}

function renderHistoryDrawer(state: GameState): void {
  const emptyState = document.getElementById('history-empty-state');
  const itemsWrapper = document.getElementById('history-items-wrapper');
  const totalRoundsText = document.getElementById('history-total-rounds-text');

  if (totalRoundsText) {
    totalRoundsText.textContent = `${state.history.length} mano${state.history.length === 1 ? '' : 's'} registrada${state.history.length === 1 ? '' : 's'}`;
  }

  if (!itemsWrapper) return;

  if (state.history.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
    itemsWrapper.innerHTML = '';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  // Render orden inverso (más reciente primero)
  const reversedHistory = [...state.history].reverse();

  itemsWrapper.innerHTML = reversedHistory
    .map((item) => {
      const starter = state.players[item.handStarterSeat];
      const isTeamA = item.winningTeam === 'teamA';
      const teamName = isTeamA ? state.teams.teamA.name : state.teams.teamB.name;
      const winnerLabel =
        item.winType === 'normal' && item.winnerSeat !== undefined
          ? `${state.players[item.winnerSeat].name} (${teamName})`
          : `Tranca ganada por ${teamName}`;

      return `
      <div class="history-card ${isTeamA ? 'winner-team-a' : 'winner-team-b'}">
        <div class="history-card-header">
          <span class="history-round-tag">Ronda ${item.round}</span>
          <span class="history-starter-info">
            <span>✋ Salió:</span>
            <strong>${starter ? starter.name : `Asiento ${item.handStarterSeat}`}</strong>
          </span>
        </div>
        <div class="history-card-body">
          <div class="history-winner-details">
            <span class="history-winner-name">${winnerLabel}</span>
            <span class="history-type-badge">
              ${item.winType === 'normal' ? '🀰 Dominada directa' : '🔒 Victoria por tranca'}
            </span>
          </div>
          <div class="history-points-block">
            <span class="history-points-gain ${isTeamA ? 'gain-team-a' : 'gain-team-b'}">+${item.points}</span>
            <span class="history-running-score">${state.teams.teamA.name}: ${item.scoreTeamAAfter} | ${state.teams.teamB.name}: ${item.scoreTeamBAfter}</span>
          </div>
        </div>
      </div>
    `;
    })
    .join('');
}

// ================= SETUP MODAL ================= //
function setupSetupModalListeners(): void {
  const btnClose = document.getElementById('btn-close-setup');
  const form = document.getElementById('setup-form') as HTMLFormElement | null;

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      playTap();
      closeSetupModal();
    });
  }

  // Selector de modalidad Bo3 / Bo5
  const btnBo3 = document.getElementById('mode-btn-bo3');
  const btnBo5 = document.getElementById('mode-btn-bo5');

  if (btnBo3) {
    btnBo3.addEventListener('click', () => {
      playTap();
      setupMatchMode = 'bo3';
      btnBo3.classList.add('active');
      btnBo3.setAttribute('aria-pressed', 'true');
      if (btnBo5) {
        btnBo5.classList.remove('active');
        btnBo5.setAttribute('aria-pressed', 'false');
      }
    });
  }

  if (btnBo5) {
    btnBo5.addEventListener('click', () => {
      playTap();
      setupMatchMode = 'bo5';
      btnBo5.classList.add('active');
      btnBo5.setAttribute('aria-pressed', 'true');
      if (btnBo3) {
        btnBo3.classList.remove('active');
        btnBo3.setAttribute('aria-pressed', 'false');
      }
    });
  }

  // Guardar setup
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      playTap();

      const teamAName = (document.getElementById('setup-team-a-name') as HTMLInputElement).value.trim() || 'Nosotros';
      const teamBName = (document.getElementById('setup-team-b-name') as HTMLInputElement).value.trim() || 'Ellos';

      const state = loadGameState();
      const currentPlayers = [
        state.players[0]?.name || 'Jugador 1',
        state.players[1]?.name || 'Jugador 2',
        state.players[2]?.name || 'Jugador 3',
        state.players[3]?.name || 'Jugador 4'
      ] as [string, string, string, string];

      setupNewMatch(
        teamAName,
        teamBName,
        currentPlayers,
        setupMatchMode
      );

      closeSetupModal();
    });
  }

  // Limpiar Partida por completo
  const btnReset = document.getElementById('btn-reset-match');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('¿Estás seguro de que quieres limpiar toda la partida y borrar el historial?')) {
        playTap();

        // Resetear form a valores por defecto
        (document.getElementById('setup-team-a-name') as HTMLInputElement).value = 'Nosotros';
        (document.getElementById('setup-team-b-name') as HTMLInputElement).value = 'Ellos';

        setupNewMatch(
          'Nosotros',
          'Ellos',
          ['Jugador 1', 'Jugador 2', 'Jugador 3', 'Jugador 4'],
          setupMatchMode
        );

        closeSetupModal();
        alert('Partida limpiada correctamente.');
      }
    });
  }
}

function openSetupModal(): void {
  const state = loadGameState();

  const inputTeamA = document.getElementById('setup-team-a-name') as HTMLInputElement | null;
  const inputTeamB = document.getElementById('setup-team-b-name') as HTMLInputElement | null;
  if (inputTeamA) inputTeamA.value = state.teams.teamA.name;
  if (inputTeamB) inputTeamB.value = state.teams.teamB.name;

  // Modalidad actual
  setupMatchMode = state.matchMode || 'bo3';
  document.querySelectorAll('.match-mode-btn').forEach((b) => b.classList.remove('active'));
  const activeBtn = document.getElementById(`mode-btn-${setupMatchMode}`);
  if (activeBtn) activeBtn.classList.add('active');

  const modal = document.getElementById('setup-modal');
  if (modal) modal.classList.add('active');
}

function closeSetupModal(): void {
  const modal = document.getElementById('setup-modal');
  if (modal) modal.classList.remove('active');
}

// ================= VICTORY MODAL & CONFETTI ================= //
function setupVictoryModalListeners(): void {
  const btnNextGame = document.getElementById('btn-next-game');
  const btnRematch = document.getElementById('btn-rematch');
  const btnNewGame = document.getElementById('btn-new-game-from-victory');

  if (btnNextGame) {
    btnNextGame.addEventListener('click', () => {
      playTap();
      stopConfetti();
      startNextGame();
      closeVictoryModal();
    });
  }

  if (btnRematch) {
    btnRematch.addEventListener('click', () => {
      playTap();
      stopConfetti();
      rematchGame();
      closeVictoryModal();
    });
  }

  if (btnNewGame) {
    btnNewGame.addEventListener('click', () => {
      playTap();
      stopConfetti();
      closeVictoryModal();
      openSetupModal();
    });
  }
}

function showVictoryModal(state: GameState): void {
  playVictory();

  const winsNeeded = getWinsNeeded(state.matchMode);
  const isSeriesOver = (state.gamesWonTeamA >= winsNeeded || state.gamesWonTeamB >= winsNeeded);
  const seriesWinner = isSeriesOver
    ? (state.gamesWonTeamA >= winsNeeded ? state.teams.teamA : state.teams.teamB)
    : null;

  const winnerTeam = state.winnerTeam === 'teamA' ? state.teams.teamA : state.teams.teamB;

  // Título y mensaje según contexto
  const titleEl = document.getElementById('modal-title-victory');
  const trophyEl = document.getElementById('victory-trophy-icon');
  const winnerNameEl = document.getElementById('victory-winner-name');

  if (isSeriesOver && seriesWinner) {
    if (titleEl) titleEl.textContent = '¡Serie Finalizada!';
    if (trophyEl) trophyEl.textContent = '🏆';
    if (winnerNameEl) winnerNameEl.textContent = `¡${seriesWinner.name} gana la serie!`;
  } else {
    if (titleEl) titleEl.textContent = `¡Partida ${state.gameNumber} Finalizada!`;
    if (trophyEl) trophyEl.textContent = '🥇';
    if (winnerNameEl) winnerNameEl.textContent = `¡${winnerTeam.name} gana esta partida!`;
  }

  // Marcador de serie
  const seriesModeLabel = document.getElementById('series-mode-label');
  const seriesGameTag = document.getElementById('series-game-tag');
  const seriesTeamAName = document.getElementById('series-team-a-name');
  const seriesTeamBName = document.getElementById('series-team-b-name');
  const seriesWinsA = document.getElementById('series-wins-a');
  const seriesWinsB = document.getElementById('series-wins-b');
  const pipContainerA = document.getElementById('series-pips-a');
  const pipContainerB = document.getElementById('series-pips-b');

  const modeLabel = state.matchMode === 'bo3' ? 'Mejor de 3' : 'Mejor de 5';

  if (seriesModeLabel) seriesModeLabel.textContent = modeLabel;
  if (seriesGameTag) seriesGameTag.textContent = `Partida ${state.gameNumber} de ${state.matchMode === 'bo3' ? 3 : 5}`;
  if (seriesTeamAName) seriesTeamAName.textContent = state.teams.teamA.name;
  if (seriesTeamBName) seriesTeamBName.textContent = state.teams.teamB.name;
  if (seriesWinsA) seriesWinsA.textContent = String(state.gamesWonTeamA);
  if (seriesWinsB) seriesWinsB.textContent = String(state.gamesWonTeamB);

  // Render pips
  function buildSeriesPips(wonCount: number, total: number, wonClass: string): string {
    let html = '';
    for (let i = 0; i < total; i++) {
      html += `<span class="series-pip ${i < wonCount ? wonClass : ''}"></span>`;
    }
    return html;
  }

  if (pipContainerA) pipContainerA.innerHTML = buildSeriesPips(state.gamesWonTeamA, winsNeeded, 'won-a');
  if (pipContainerB) pipContainerB.innerHTML = buildSeriesPips(state.gamesWonTeamB, winsNeeded, 'won-b');

  // Marcador final de la partida
  const finalTeamA = document.getElementById('final-team-a-name');
  const finalTeamB = document.getElementById('final-team-b-name');
  const finalScoreA = document.getElementById('final-score-a');
  const finalScoreB = document.getElementById('final-score-b');

  if (finalTeamA) finalTeamA.textContent = state.teams.teamA.name;
  if (finalTeamB) finalTeamB.textContent = state.teams.teamB.name;
  if (finalScoreA) finalScoreA.textContent = String(state.scoreTeamA);
  if (finalScoreB) finalScoreB.textContent = String(state.scoreTeamB);

  // Estadísticas
  const totalHandsEl = document.getElementById('stat-total-hands');
  const diffPointsEl = document.getElementById('stat-diff-points');
  const handsTeamAEl = document.getElementById('stat-hands-team-a');
  const handsTeamBEl = document.getElementById('stat-hands-team-b');
  const maxPointsEl = document.getElementById('stat-max-points');
  const avgPointsEl = document.getElementById('stat-avg-points');

  const handsWonA = state.history.filter((h) => h.winningTeam === 'teamA').length;
  const handsWonB = state.history.filter((h) => h.winningTeam === 'teamB').length;
  const maxHandPts = state.history.length > 0 ? Math.max(...state.history.map((h) => h.points)) : 0;
  const totalPts = state.history.reduce((acc, h) => acc + h.points, 0);
  const avgPts = state.history.length > 0 ? (totalPts / state.history.length).toFixed(1) : '0';

  if (totalHandsEl) totalHandsEl.textContent = String(state.history.length);
  if (diffPointsEl) diffPointsEl.textContent = `${Math.abs(state.scoreTeamA - state.scoreTeamB)} pts`;
  if (handsTeamAEl) handsTeamAEl.textContent = `${handsWonA} (${state.teams.teamA.name})`;
  if (handsTeamBEl) handsTeamBEl.textContent = `${handsWonB} (${state.teams.teamB.name})`;
  if (maxPointsEl) maxPointsEl.textContent = `${maxHandPts} pts`;
  if (avgPointsEl) avgPointsEl.textContent = `${avgPts} pts`;

  // Render history list
  const historyListEl = document.getElementById('victory-history-list');
  if (historyListEl) {
    if (state.history.length === 0) {
      historyListEl.innerHTML = '<p class="empty-note">Sin jugadas registradas</p>';
    } else {
      historyListEl.innerHTML = [...state.history].reverse().map(item => {
        const starter = state.players[item.handStarterSeat];
        const isTeamA = item.winningTeam === 'teamA';
        const teamName = isTeamA ? state.teams.teamA.name : state.teams.teamB.name;
        const winnerLabel = item.winType === 'normal' && item.winnerSeat !== undefined
          ? `${state.players[item.winnerSeat].name} (${teamName})`
          : `Tranca ganada por ${teamName}`;

        return `
          <div class="history-card ${isTeamA ? 'winner-team-a' : 'winner-team-b'}" style="margin-bottom:0; font-size: 0.85rem;">
            <div class="history-card-header">
              <span class="history-round-tag">Ronda ${item.round}</span>
              <span class="history-starter-info">
                <span>✋ Salió:</span> <strong>${starter ? starter.name : '?'}</strong>
              </span>
            </div>
            <div class="history-card-body">
              <div class="history-winner-details">
                <span class="history-winner-name">${winnerLabel}</span>
              </div>
              <div class="history-points-block">
                <span class="history-points-gain ${isTeamA ? 'gain-team-a' : 'gain-team-b'}">+${item.points}</span>
                <span class="history-running-score">${state.teams.teamA.name}: ${item.scoreTeamAAfter} | ${state.teams.teamB.name}: ${item.scoreTeamBAfter}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Botones: mostrar el correcto según si la serie terminó
  const btnNextGame = document.getElementById('btn-next-game');
  const btnRematch = document.getElementById('btn-rematch');
  const btnNextLabel = document.getElementById('btn-next-game-label');

  if (isSeriesOver) {
    // Serie terminada: mostrar "Nueva serie"
    if (btnNextGame) btnNextGame.style.display = 'none';
    if (btnRematch) btnRematch.style.display = 'flex';
  } else {
    // Serie en curso: mostrar "Siguiente partida"
    const gamesLeft = state.matchMode === 'bo3' ? 3 - state.gameNumber : 5 - state.gameNumber;
    if (btnNextLabel) btnNextLabel.textContent = `Siguiente Partida (${state.gamesWonTeamA} - ${state.gamesWonTeamB}) →`;
    if (btnNextGame) btnNextGame.style.display = 'flex';
    if (btnRematch) btnRematch.style.display = 'none';
  }

  const modal = document.getElementById('victory-modal');
  if (modal) modal.classList.add('active');

  startConfetti();
}

function closeVictoryModal(): void {
  stopConfetti();
  const modal = document.getElementById('victory-modal');
  if (modal) modal.classList.remove('active');
}

// ================= CONFIRMACIÓN DE SALIDOR ================= //
function showStarterConfirmBanner(state: GameState, seat: SeatIndex): void {
  const banner = document.getElementById('confirm-starter-banner');
  const nameEl = document.getElementById('confirm-starter-name');
  if (!banner || !nameEl) return;

  nameEl.textContent = state.players[seat]?.name || '—';
  banner.classList.remove('hidden');

  // Marcar visualmente el asiento seleccionado como pendiente
  document.querySelectorAll('.seat-card').forEach((c) => c.classList.remove('is-starter-pending'));
  const card = document.getElementById(`seat-card-${seat}`);
  card?.classList.add('is-starter-pending');
}

function hideStarterConfirmBanner(): void {
  const banner = document.getElementById('confirm-starter-banner');
  banner?.classList.add('hidden');
  // Limpiar todos los pendientes
  document.querySelectorAll('.seat-card').forEach((c) => c.classList.remove('is-starter-pending'));
  pendingStarterSeat = null;
}

function setupStarterConfirmListeners(): void {
  const btnConfirm = document.getElementById('btn-confirm-starter');
  const btnCancel = document.getElementById('btn-cancel-starter');

  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      if (pendingStarterSeat === null) return;
      playDominoSlam();
      setHandStarter(pendingStarterSeat);
      hideStarterConfirmBanner();
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      playTap();
      hideStarterConfirmBanner();
    });
  }
}

// ================= CONFETTI ================= //

function startConfetti(): void {
  const canvas = document.getElementById('confetti-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = window.innerWidth || 400;
  canvas.height = window.innerHeight || 600;

  const particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    rot: number;
    rotSpeed: number;
  }> = [];

  const colors = ['#fbbf24', '#3b82f6', '#f97316', '#10b981', '#ffffff'];

  for (let i = 0; i < 70; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8,
    });
  }

  function frame(): void {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotSpeed;

      if (p.y > canvas.height) {
        p.y = -10;
        p.x = Math.random() * canvas.width;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });

    confettiAnimationId = requestAnimationFrame(frame);
  }

  stopConfetti();
  frame();
}

function stopConfetti(): void {
  if (confettiAnimationId !== null) {
    cancelAnimationFrame(confettiAnimationId);
    confettiAnimationId = null;
  }
}
