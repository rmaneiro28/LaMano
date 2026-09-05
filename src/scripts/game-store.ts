import type {
  GameState,
  GameSettings,
  HandRecord,
  HandWinType,
  Player,
  SeatIndex,
  TeamId,
  TurnDirection,
  ExitRule,
} from './types';

const STORAGE_KEY = 'lamano_game_v1';
export const STATE_CHANGE_EVENT = 'lamano:statechange';

export function getDefaultPlayers(): [Player, Player, Player, Player] {
  return [
    { id: 1, name: 'Jugador 1', seat: 0, team: 'teamA' },
    { id: 2, name: 'Jugador 2', seat: 1, team: 'teamB' },
    { id: 3, name: 'Jugador 3', seat: 2, team: 'teamA' },
    { id: 4, name: 'Jugador 4', seat: 3, team: 'teamB' },
  ];
}

export function getDefaultSettings(): GameSettings {
  return {
    targetScore: 100,
    direction: 'counter-clockwise',
    exitRule: 'rotation',
    firstHandStarterSeat: 0,
  };
}

export function createInitialState(
  teamAName = 'Nosotros',
  teamBName = 'Ellos',
  playerNames: [string, string, string, string] = ['Jugador 1', 'Jugador 2', 'Jugador 3', 'Jugador 4'],
  settings: Partial<GameSettings> = {}
): GameState {
  const mergedSettings: GameSettings = {
    ...getDefaultSettings(),
    ...settings,
  };

  const players: [Player, Player, Player, Player] = [
    { id: 1, name: playerNames[0] || 'Jugador 1', seat: 0, team: 'teamA' },
    { id: 2, name: playerNames[1] || 'Jugador 2', seat: 1, team: 'teamB' },
    { id: 3, name: playerNames[2] || 'Jugador 3', seat: 2, team: 'teamA' },
    { id: 4, name: playerNames[3] || 'Jugador 4', seat: 3, team: 'teamB' },
  ];

  return {
    isConfigured: true,
    teams: {
      teamA: { id: 'teamA', name: teamAName || 'Nosotros', colorName: 'blue' },
      teamB: { id: 'teamB', name: teamBName || 'Ellos', colorName: 'amber' },
    },
    players,
    settings: mergedSettings,
    currentRound: 1,
    currentHandStarterSeat: mergedSettings.firstHandStarterSeat,
    scoreTeamA: 0,
    scoreTeamB: 0,
    history: [],
    isFinished: false,
    winnerTeam: undefined,
  };
}

/**
 * Calcula el siguiente asiento según la dirección del juego.
 * Antihorario (default dominó): 0 -> 1 -> 2 -> 3 -> 0 (+1 asiento)
 * Horario: 0 -> 3 -> 2 -> 1 -> 0 (-1 asiento)
 */
export function getNextSeatByDirection(currentSeat: SeatIndex, direction: TurnDirection): SeatIndex {
  if (direction === 'counter-clockwise') {
    return ((currentSeat + 1) % 4) as SeatIndex;
  } else {
    return (((currentSeat - 1) + 4) % 4) as SeatIndex;
  }
}

/**
 * Determina el equipo de un asiento (0 y 2 -> Equipo A; 1 y 3 -> Equipo B)
 */
export function getTeamBySeat(seat: SeatIndex): TeamId {
  return seat % 2 === 0 ? 'teamA' : 'teamB';
}

/**
 * Calcula quién debe salir en la siguiente mano según las reglas del juego.
 */
export function calculateNextStarter(
  currentStarter: SeatIndex,
  exitRule: ExitRule,
  direction: TurnDirection,
  winType: HandWinType,
  winnerSeat?: SeatIndex,
  trancaLeadSeat?: SeatIndex
): SeatIndex {
  // Opción A: Rotación continua (Estándar de Federación)
  if (exitRule === 'rotation') {
    return getNextSeatByDirection(currentStarter, direction);
  }

  // Opción B: Tradicional / Calle (Sale el que dominó)
  if (exitRule === 'winner') {
    if (winType === 'normal' && winnerSeat !== undefined) {
      return winnerSeat;
    }
    // En caso de tranca: si se designó un salidor específico (ej. el que cerró la partida), sale él;
    // de lo contrario, aplica la rotación continua tradicional.
    if (winType === 'tranca') {
      if (trancaLeadSeat !== undefined) {
        return trancaLeadSeat;
      }
      return getNextSeatByDirection(currentStarter, direction);
    }
  }

  return getNextSeatByDirection(currentStarter, direction);
}

// ================= ESTADO Y PERSISTENCIA ================= //

let memoryState: GameState | null = null;

export function loadGameState(): GameState {
  if (typeof window === 'undefined') {
    return createInitialState();
  }

  if (memoryState) return memoryState;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      if (parsed && parsed.teams && parsed.players && parsed.settings) {
        memoryState = parsed;
        return memoryState;
      }
    }
  } catch (err) {
    console.error('Error cargando estado de localStorage:', err);
  }

  // Estado por defecto listo para jugar
  memoryState = createInitialState();
  saveGameState(memoryState);
  return memoryState;
}

export function saveGameState(state: GameState): void {
  memoryState = state;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.dispatchEvent(new CustomEvent(STATE_CHANGE_EVENT, { detail: state }));
    } catch (err) {
      console.error('Error guardando estado en localStorage:', err);
    }
  }
}

/**
 * Registra una nueva mano jugada y avanza el juego.
 */
export function recordHand(
  winType: HandWinType,
  points: number,
  winnerSeat?: SeatIndex,
  winningTeamParam?: TeamId,
  trancaLeadSeat?: SeatIndex
): GameState {
  const state = { ...loadGameState() };

  if (state.isFinished) {
    throw new Error('La partida ya ha finalizado.');
  }

  if (points < 0 || !Number.isInteger(points)) {
    throw new Error('Los puntos deben ser un número entero positivo.');
  }

  // Determinar equipo ganador
  let winningTeam: TeamId;
  if (winType === 'normal') {
    if (winnerSeat === undefined) {
      throw new Error('Debe indicarse el jugador que dominó la mano.');
    }
    winningTeam = getTeamBySeat(winnerSeat);
  } else {
    // Tranca
    if (!winningTeamParam) {
      throw new Error('Debe indicarse el equipo ganador de la tranca.');
    }
    winningTeam = winningTeamParam;
  }

  const scoreABefore = state.scoreTeamA;
  const scoreBBefore = state.scoreTeamB;

  const scoreAAfter = winningTeam === 'teamA' ? scoreABefore + points : scoreABefore;
  const scoreBAfter = winningTeam === 'teamB' ? scoreBBefore + points : scoreBBefore;

  const nextStarter = calculateNextStarter(
    state.currentHandStarterSeat,
    state.settings.exitRule,
    state.settings.direction,
    winType,
    winnerSeat,
    trancaLeadSeat
  );

  const handRecord: HandRecord = {
    round: state.currentRound,
    handStarterSeat: state.currentHandStarterSeat,
    winType,
    winnerSeat,
    winningTeam,
    points,
    scoreTeamABefore: scoreABefore,
    scoreTeamBBefore: scoreBBefore,
    scoreTeamAAfter: scoreAAfter,
    scoreTeamBAfter: scoreBAfter,
    timestamp: Date.now(),
    nextHandStarterSeat: nextStarter,
  };

  const isFinished = scoreAAfter >= state.settings.targetScore || scoreBAfter >= state.settings.targetScore;
  let winnerTeam: TeamId | undefined;
  if (isFinished) {
    winnerTeam = scoreAAfter >= state.settings.targetScore ? 'teamA' : 'teamB';
  }

  state.scoreTeamA = scoreAAfter;
  state.scoreTeamB = scoreBAfter;
  state.history = [...state.history, handRecord];
  state.isFinished = isFinished;
  state.winnerTeam = winnerTeam;

  if (!isFinished) {
    state.currentRound = state.currentRound + 1;
    state.currentHandStarterSeat = nextStarter;
  }

  saveGameState(state);
  return state;
}

/**
 * Deshace la última mano registrada restaurando el puntaje y salidor anterior.
 */
export function undoLastHand(): GameState {
  const state = { ...loadGameState() };
  if (state.history.length === 0) return state;

  const lastHand = state.history[state.history.length - 1];
  const newHistory = state.history.slice(0, -1);

  state.scoreTeamA = lastHand.scoreTeamABefore;
  state.scoreTeamB = lastHand.scoreTeamBBefore;
  state.currentRound = lastHand.round;
  state.currentHandStarterSeat = lastHand.handStarterSeat;
  state.history = newHistory;
  state.isFinished = false;
  state.winnerTeam = undefined;

  saveGameState(state);
  return state;
}

/**
 * Inicia una revancha manteniendo los mismos equipos y jugadores.
 */
export function rematchGame(customFirstStarter?: SeatIndex): GameState {
  const current = loadGameState();
  // Para la revancha, por cortesía o rotación, podemos rotar la salida inicial o usar la configurada
  const starter = customFirstStarter !== undefined
    ? customFirstStarter
    : getNextSeatByDirection(current.settings.firstHandStarterSeat, current.settings.direction);

  const updatedSettings: GameSettings = {
    ...current.settings,
    firstHandStarterSeat: starter,
  };

  const newState: GameState = {
    ...current,
    settings: updatedSettings,
    currentRound: 1,
    currentHandStarterSeat: starter,
    scoreTeamA: 0,
    scoreTeamB: 0,
    history: [],
    isFinished: false,
    winnerTeam: undefined,
  };

  saveGameState(newState);
  return newState;
}

/**
 * Reinicia completamente la partida con nueva configuración.
 */
export function setupNewGame(
  teamAName: string,
  teamBName: string,
  playerNames: [string, string, string, string],
  settings: GameSettings
): GameState {
  const newState = createInitialState(teamAName, teamBName, playerNames, settings);
  saveGameState(newState);
  return newState;
}
