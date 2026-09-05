import {
  loadGameState,
  recordHand,
  undoLastHand,
  rematchGame,
  setupNewGame,
  STATE_CHANGE_EVENT,
  getTeamBySeat,
} from './game-store';
import type { GameState, SeatIndex, TeamId, HandWinType, TurnDirection, ExitRule } from './types';
import {
  initSoundSettings,
  toggleMute,
  isAudioMuted,
  playTap,
  playDominoSlam,
  playUndo,
  playVictory,
} from './audio';
import { initWakeLock, requestWakeLock, releaseWakeLock } from './wake-lock';

// ================= ESTADO LOCAL DE FORMULARIOS ================= //
let closeHandWinType: HandWinType = 'normal';
let closeHandWinnerSeat: SeatIndex | undefined = undefined;
let closeHandWinnerTeam: TeamId | undefined = undefined;
let closeHandPoints = 0;
let setupFirstStarterSeat: SeatIndex = 0;
let isWakeLockActive = false;

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

  if (nameA) nameA.textContent = state.teams.teamA.name;
  if (nameB) nameB.textContent = state.teams.teamB.name;
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
}

function renderDominoTable(state: GameState): void {
  // Render de cada jugador en su asiento
  state.players.forEach((player) => {
    const nameEl = document.getElementById(`seat-player-name-${player.seat}`);
    const teamEl = document.getElementById(`seat-player-team-${player.seat}`);
    const cardEl = document.getElementById(`seat-card-${player.seat}`);
    const badgeEl = document.getElementById(`hand-indicator-${player.seat}`);

    if (nameEl) nameEl.textContent = player.name;
    if (teamEl) {
      teamEl.textContent = player.team === 'teamA' ? state.teams.teamA.name : state.teams.teamB.name;
    }

    const isStarter = state.currentHandStarterSeat === player.seat;
    if (cardEl) {
      if (isStarter) {
        cardEl.classList.add('is-hand-starter');
      } else {
        cardEl.classList.remove('is-hand-starter');
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

  // Centro de mesa: sentido y criterio
  const rotationSymbol = document.getElementById('rotation-symbol');
  const rotationText = document.getElementById('rotation-text');
  const exitRuleBadge = document.getElementById('exit-rule-badge');

  if (rotationSymbol && rotationText) {
    if (state.settings.direction === 'counter-clockwise') {
      rotationSymbol.textContent = '↺';
      rotationText.textContent = 'Antihorario';
    } else {
      rotationSymbol.textContent = '↻';
      rotationText.textContent = 'Horario';
    }
  }

  if (exitRuleBadge) {
    exitRuleBadge.textContent = state.settings.exitRule === 'rotation' ? 'Rotación' : 'Por Dominada';
  }

  // Banner contextual de salida
  const starterPlayer = state.players[state.currentHandStarterSeat];
  const starterName = document.getElementById('banner-starter-name');
  const starterTeam = document.getElementById('banner-starter-team');

  if (starterName && starterPlayer) {
    starterName.textContent = starterPlayer.name;
  }
  if (starterTeam && starterPlayer) {
    starterTeam.textContent = starterPlayer.team === 'teamA' ? state.teams.teamA.name : state.teams.teamB.name;
    starterTeam.className = `turn-team-badge ${starterPlayer.team === 'teamA' ? 'badge-team-a' : 'badge-team-b'}`;
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
    btnCloseHand.disabled = state.isFinished;
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

  // Reset de valores locales
  closeHandWinType = 'normal';
  closeHandWinnerSeat = undefined;
  closeHandWinnerTeam = undefined;
  closeHandPoints = 0;

  // Actualizar títulos e info
  const subtitleRound = document.getElementById('modal-subtitle-round');
  if (subtitleRound) {
    subtitleRound.textContent = `Ronda ${state.currentRound} • Salidor: ${state.players[state.currentHandStarterSeat].name}`;
  }

  // Actualizar nombres de jugadores en el selector
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
        document.querySelectorAll('.player-select-btn').forEach((b) => b.classList.remove('selected'));
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

      recordHand(
        closeHandWinType,
        closeHandPoints,
        closeHandWinnerSeat,
        closeHandWinnerTeam
      );

      closeCloseHandModal();
    });
  }
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

  if (closeHandWinType === 'normal' && closeHandWinnerSeat !== undefined) {
    const player = state.players[closeHandWinnerSeat];
    const team = player.team === 'teamA' ? state.teams.teamA : state.teams.teamB;
    const currentScore = player.team === 'teamA' ? state.scoreTeamA : state.scoreTeamB;
    const newScore = currentScore + closeHandPoints;

    previewText.innerHTML = `<strong>${player.name}</strong> sumará <strong>+${closeHandPoints} pts</strong> a ${team.name} (Total: ${newScore}/${state.settings.targetScore})`;
  } else if (closeHandWinType === 'tranca' && closeHandWinnerTeam) {
    const team = closeHandWinnerTeam === 'teamA' ? state.teams.teamA : state.teams.teamB;
    const currentScore = closeHandWinnerTeam === 'teamA' ? state.scoreTeamA : state.scoreTeamB;
    const newScore = currentScore + closeHandPoints;

    previewText.innerHTML = `Tranca ganada por <strong>${team.name}</strong> con <strong>+${closeHandPoints} pts</strong> (Total: ${newScore}/${state.settings.targetScore})`;
  } else {
    previewText.textContent = 'Selecciona quién ganó y anota los puntos de la mano.';
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

  // Presets de meta de puntos
  document.querySelectorAll('.preset-btn[data-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      playTap();
      document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const targetVal = (btn as HTMLElement).dataset.target;
      const targetInput = document.getElementById('setup-target-score') as HTMLInputElement | null;
      if (targetInput && targetVal) {
        targetInput.value = targetVal;
      }
    });
  });

  // Selector de salidor Ronda 1
  for (let s = 0; s < 4; s++) {
    const starterBtn = document.getElementById(`starter-btn-${s}`);
    if (starterBtn) {
      starterBtn.addEventListener('click', () => {
        playTap();
        setupFirstStarterSeat = s as SeatIndex;
        document.querySelectorAll('.starter-seat-btn').forEach((b) => b.classList.remove('active'));
        starterBtn.classList.add('active');
      });
    }
  }

  // Sincronizar nombres con preview de salidor
  const playerInputs = [
    document.getElementById('setup-player-0') as HTMLInputElement | null,
    document.getElementById('setup-player-1') as HTMLInputElement | null,
    document.getElementById('setup-player-2') as HTMLInputElement | null,
    document.getElementById('setup-player-3') as HTMLInputElement | null,
  ];

  playerInputs.forEach((inp, idx) => {
    if (inp) {
      inp.addEventListener('input', () => {
        const preview = document.getElementById(`preview-starter-${idx}`);
        if (preview) preview.textContent = inp.value || `Jugador ${idx + 1}`;
      });
    }
  });

  // Guardar setup
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      playTap();

      const teamAName = (document.getElementById('setup-team-a-name') as HTMLInputElement).value.trim() || 'Nosotros';
      const teamBName = (document.getElementById('setup-team-b-name') as HTMLInputElement).value.trim() || 'Ellos';

      const p0 = (document.getElementById('setup-player-0') as HTMLInputElement).value.trim() || 'Jugador 1';
      const p1 = (document.getElementById('setup-player-1') as HTMLInputElement).value.trim() || 'Jugador 2';
      const p2 = (document.getElementById('setup-player-2') as HTMLInputElement).value.trim() || 'Jugador 3';
      const p3 = (document.getElementById('setup-player-3') as HTMLInputElement).value.trim() || 'Jugador 4';

      const targetScore = parseInt((document.getElementById('setup-target-score') as HTMLInputElement).value, 10) || 100;

      const directionRadio = document.querySelector('input[name="setup-direction"]:checked') as HTMLInputElement | null;
      const direction = (directionRadio?.value as TurnDirection) || 'counter-clockwise';

      const exitRuleRadio = document.querySelector('input[name="setup-exit-rule"]:checked') as HTMLInputElement | null;
      const exitRule = (exitRuleRadio?.value as ExitRule) || 'rotation';

      setupNewGame(
        teamAName,
        teamBName,
        [p0, p1, p2, p3],
        {
          targetScore,
          direction,
          exitRule,
          firstHandStarterSeat: setupFirstStarterSeat,
        }
      );

      closeSetupModal();
    });
  }
}

function openSetupModal(): void {
  const state = loadGameState();

  const inputTeamA = document.getElementById('setup-team-a-name') as HTMLInputElement | null;
  const inputTeamB = document.getElementById('setup-team-b-name') as HTMLInputElement | null;
  if (inputTeamA) inputTeamA.value = state.teams.teamA.name;
  if (inputTeamB) inputTeamB.value = state.teams.teamB.name;

  state.players.forEach((p) => {
    const pInput = document.getElementById(`setup-player-${p.seat}`) as HTMLInputElement | null;
    const preview = document.getElementById(`preview-starter-${p.seat}`);
    if (pInput) pInput.value = p.name;
    if (preview) preview.textContent = p.name;
  });

  const inputTarget = document.getElementById('setup-target-score') as HTMLInputElement | null;
  if (inputTarget) inputTarget.value = String(state.settings.targetScore);

  // Marcar radio direction
  const dirRadio = document.querySelector(`input[name="setup-direction"][value="${state.settings.direction}"]`) as HTMLInputElement | null;
  if (dirRadio) dirRadio.checked = true;

  // Marcar radio exitRule
  const ruleRadio = document.querySelector(`input[name="setup-exit-rule"][value="${state.settings.exitRule}"]`) as HTMLInputElement | null;
  if (ruleRadio) ruleRadio.checked = true;

  // Salidor
  setupFirstStarterSeat = state.settings.firstHandStarterSeat;
  document.querySelectorAll('.starter-seat-btn').forEach((b) => b.classList.remove('active'));
  const activeStarterBtn = document.getElementById(`starter-btn-${setupFirstStarterSeat}`);
  if (activeStarterBtn) activeStarterBtn.classList.add('active');

  const modal = document.getElementById('setup-modal');
  if (modal) modal.classList.add('active');
}

function closeSetupModal(): void {
  const modal = document.getElementById('setup-modal');
  if (modal) modal.classList.remove('active');
}

// ================= VICTORY MODAL & CONFETTI ================= //
function setupVictoryModalListeners(): void {
  const btnRematch = document.getElementById('btn-rematch');
  const btnNewGame = document.getElementById('btn-new-game-from-victory');

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

  const winnerTeam = state.winnerTeam === 'teamA' ? state.teams.teamA : state.teams.teamB;
  const winnerNameEl = document.getElementById('victory-winner-name');
  const finalTeamA = document.getElementById('final-team-a-name');
  const finalTeamB = document.getElementById('final-team-b-name');
  const finalScoreA = document.getElementById('final-score-a');
  const finalScoreB = document.getElementById('final-score-b');

  if (winnerNameEl) winnerNameEl.textContent = `¡${winnerTeam.name} se corona campeón!`;
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

  const modal = document.getElementById('victory-modal');
  if (modal) modal.classList.add('active');

  startConfetti();
}

function closeVictoryModal(): void {
  stopConfetti();
  const modal = document.getElementById('victory-modal');
  if (modal) modal.classList.remove('active');
}

// Confetti Animado Nativo
function startConfetti(): void {
  const canvas = document.getElementById('confetti-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = canvas.parentElement?.clientWidth || 400;
  canvas.height = canvas.parentElement?.clientHeight || 600;

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
