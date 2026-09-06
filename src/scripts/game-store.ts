import type {
  GameState,
  GameSettings,
  GameResult,
  HandRecord,
  HandWinType,
  MatchMode,
  Player,
  SeatIndex,
  TeamId,
} from './types';

const STORAGE_KEY = 'lamano_game_v2';
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
    targetScore: 100, // Siempre a 100 puntos
    direction: 'counter-clockwise', // Siempre antihorario
    exitRule: 'rotation', // Siempre rotación continua
    firstHandStarterSeat: 0,
  };
}

/** Crea el estado inicial de una NUEVA SERIE completa */
export function createInitialState(
  teamAName = 'Nosotros',
  teamBName = 'Ellos',
  playerNames: [string, string, string, string] = ['Jugador 1', 'Jugador 2', 'Jugador 3', 'Jugador 4'],
  matchMode: MatchMode = 'bo3',
  starterSeat: SeatIndex = 0,
  starterConfirmed = false
): GameState {
  const mergedSettings: GameSettings = {
    ...getDefaultSettings(),
    targetScore: 100,
    direction: 'counter-clockwise',
    exitRule: 'rotation',
    firstHandStarterSeat: starterSeat,
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

    matchMode,
    gameNumber: 1,
    gamesWonTeamA: 0,
    gamesWonTeamB: 0,
    gameHistory: [],

    currentRound: 1,
    currentHandStarterSeat: starterSeat,
    starterConfirmed,
    scoreTeamA: 0,
    scoreTeamB: 0,
    history: [],
    isFinished: false,
    winnerTeam: undefined,
    matchWinner: undefined,
  };
}

/**
 * Calcula el siguiente asiento siempre en rotación continua antihoraria:
 * 0 (Sur) -> 1 (Este) -> 2 (Norte) -> 3 (Oeste) -> 0 (+1 asiento)
 */
export function getNextSeatAntiClockwise(currentSeat: SeatIndex): SeatIndex {
  return ((currentSeat + 1) % 4) as SeatIndex;
}

/**
 * Determina el equipo de un asiento (0 y 2 -> Equipo A; 1 y 3 -> Equipo B)
 */
export function getTeamBySeat(seat: SeatIndex): TeamId {
  return seat % 2 === 0 ? 'teamA' : 'teamB';
}

/** Devuelve cuántas victorias necesita un equipo para ganar la serie */
export function getWinsNeeded(matchMode: MatchMode): number {
  return matchMode === 'bo3' ? 2 : 3;
}

// ================= ESTADO Y PERSISTENCIA ================= //

let memoryState: GameState | null = null;

export function loadGameState(): GameState {
  if (typeof window === 'undefined') {
    return createInitialState();
  }

  if (memoryState) return memoryState;

  try {
    // Intentar cargar la versión nueva primero
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      if (parsed && parsed.teams && parsed.players && parsed.settings) {
        // Asegurar reglas fijas
        parsed.settings.targetScore = 100;
        parsed.settings.direction = 'counter-clockwise';
        parsed.settings.exitRule = 'rotation';

        // Migración: si falta matchMode o campos de serie, agregar valores por defecto
        if (!parsed.matchMode) parsed.matchMode = 'bo3';
        if (parsed.gameNumber === undefined) parsed.gameNumber = 1;
        if (parsed.gamesWonTeamA === undefined) parsed.gamesWonTeamA = 0;
        if (parsed.gamesWonTeamB === undefined) parsed.gamesWonTeamB = 0;
        if (!parsed.gameHistory) parsed.gameHistory = [];

        if (parsed.starterConfirmed === undefined) {
          parsed.starterConfirmed = parsed.history.length > 0;
        }
        memoryState = parsed;
        return memoryState;
      }
    }

    // Intentar migrar desde versión anterior
    const oldRaw = localStorage.getItem('lamano_game_v1');
    if (oldRaw) {
      const oldParsed = JSON.parse(oldRaw) as GameState;
      if (oldParsed && oldParsed.teams && oldParsed.players) {
        oldParsed.settings.targetScore = 100;
        oldParsed.settings.direction = 'counter-clockwise';
        oldParsed.settings.exitRule = 'rotation';
        if (!oldParsed.matchMode) oldParsed.matchMode = 'bo3';
        if (oldParsed.gameNumber === undefined) oldParsed.gameNumber = 1;
        if (oldParsed.gamesWonTeamA === undefined) oldParsed.gamesWonTeamA = 0;
        if (oldParsed.gamesWonTeamB === undefined) oldParsed.gamesWonTeamB = 0;
        if (!oldParsed.gameHistory) oldParsed.gameHistory = [];
        if (oldParsed.starterConfirmed === undefined) {
          oldParsed.starterConfirmed = oldParsed.history.length > 0;
        }
        memoryState = oldParsed;
        saveGameState(memoryState); // Guardar con nueva clave
        return memoryState;
      }
    }
  } catch (err) {
    console.error('Error cargando estado de localStorage:', err);
  }

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
 * Establece o confirma el jugador salidor de la mano actual.
 */
export function setHandStarter(seat: SeatIndex): GameState {
  const state = { ...loadGameState() };
  state.currentHandStarterSeat = seat;
  state.starterConfirmed = true;
  if (state.currentRound === 1) {
    state.settings.firstHandStarterSeat = seat;
  }
  saveGameState(state);
  return state;
}

/**
 * Registra una nueva mano jugada y avanza el juego siempre con rotación continua antihoraria.
 * Cuando termina la partida, actualiza el contador de victorias de la serie.
 */
export function recordHand(
  winType: HandWinType,
  points: number,
  winnerSeat?: SeatIndex,
  winningTeamParam?: TeamId,
  confirmedStarterSeat?: SeatIndex
): GameState {
  const state = { ...loadGameState() };

  if (state.isFinished) {
    throw new Error('La partida ya ha finalizado.');
  }

  if (points < 0 || !Number.isInteger(points)) {
    throw new Error('Los puntos deben ser un número entero positivo.');
  }

  // Si se proporcionó un salidor confirmado en el modal, usarlo
  const actualStarter = confirmedStarterSeat !== undefined ? confirmedStarterSeat : state.currentHandStarterSeat;

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

  // Rotación siempre antihoraria al siguiente asiento
  const nextStarter = getNextSeatAntiClockwise(actualStarter);

  const handRecord: HandRecord = {
    round: state.currentRound,
    handStarterSeat: actualStarter,
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

  const isFinished = scoreAAfter >= 100 || scoreBAfter >= 100;
  let winnerTeam: TeamId | undefined;
  let matchWinner: TeamId | undefined;

  if (isFinished) {
    winnerTeam = scoreAAfter >= 100 ? 'teamA' : 'teamB';

    // Actualizar conteo de series
    const gameResult: GameResult = {
      gameNumber: state.gameNumber,
      winnerTeam,
      scoreTeamA: scoreAAfter,
      scoreTeamB: scoreBAfter,
      handsPlayed: state.currentRound,
    };

    const newGamesWonA = state.gamesWonTeamA + (winnerTeam === 'teamA' ? 1 : 0);
    const newGamesWonB = state.gamesWonTeamB + (winnerTeam === 'teamB' ? 1 : 0);
    const winsNeeded = getWinsNeeded(state.matchMode);

    state.gamesWonTeamA = newGamesWonA;
    state.gamesWonTeamB = newGamesWonB;
    state.gameHistory = [...state.gameHistory, gameResult];

    if (newGamesWonA >= winsNeeded) {
      matchWinner = 'teamA';
    } else if (newGamesWonB >= winsNeeded) {
      matchWinner = 'teamB';
    }
  }

  state.scoreTeamA = scoreAAfter;
  state.scoreTeamB = scoreBAfter;
  state.history = [...state.history, handRecord];
  state.isFinished = isFinished;
  state.winnerTeam = winnerTeam;
  state.matchWinner = matchWinner;

  if (!isFinished) {
    state.currentRound = state.currentRound + 1;
    state.currentHandStarterSeat = nextStarter;
    state.starterConfirmed = true; // Para las siguientes manos ya rota automáticamente
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

  // Si la partida estaba terminada, revertir también los conteos de serie
  if (state.isFinished && state.winnerTeam) {
    if (state.winnerTeam === 'teamA') {
      state.gamesWonTeamA = Math.max(0, state.gamesWonTeamA - 1);
    } else {
      state.gamesWonTeamB = Math.max(0, state.gamesWonTeamB - 1);
    }
    if (state.gameHistory.length > 0) {
      state.gameHistory = state.gameHistory.slice(0, -1);
    }
  }

  state.scoreTeamA = lastHand.scoreTeamABefore;
  state.scoreTeamB = lastHand.scoreTeamBBefore;
  state.currentRound = lastHand.round;
  state.currentHandStarterSeat = lastHand.handStarterSeat;
  state.starterConfirmed = true;
  state.history = newHistory;
  state.isFinished = false;
  state.winnerTeam = undefined;
  state.matchWinner = undefined;

  saveGameState(state);
  return state;
}

/**
 * Inicia la SIGUIENTE PARTIDA dentro de la misma serie,
 * conservando equipos, jugadores, matchMode y victorias acumuladas.
 * El salidor de la nueva partida rota antihorario del último salidor.
 */
export function startNextGame(): GameState {
  const current = loadGameState();

  // El próximo salidor rota desde el salidor de la última mano
  const lastHand = current.history[current.history.length - 1];
  const nextStarter: SeatIndex = lastHand
    ? getNextSeatAntiClockwise(lastHand.handStarterSeat)
    : getNextSeatAntiClockwise(current.settings.firstHandStarterSeat);

  const newState: GameState = {
    ...current,
    settings: {
      ...current.settings,
      firstHandStarterSeat: nextStarter,
    },
    gameNumber: current.gameNumber + 1,
    currentRound: 1,
    currentHandStarterSeat: nextStarter,
    starterConfirmed: false, // Requiere confirmar en la mesa para la nueva partida
    scoreTeamA: 0,
    scoreTeamB: 0,
    history: [],
    isFinished: false,
    winnerTeam: undefined,
    matchWinner: undefined,
  };

  saveGameState(newState);
  return newState;
}

/**
 * Inicia una revancha manteniendo los mismos equipos y rotando el salidor inicial.
 * @deprecated Usar setupNewMatch o startNextGame. Mantenida por compatibilidad.
 */
export function rematchGame(customFirstStarter?: SeatIndex): GameState {
  const current = loadGameState();
  const starter = customFirstStarter !== undefined
    ? customFirstStarter
    : getNextSeatAntiClockwise(current.settings.firstHandStarterSeat);

  const newState = createInitialState(
    current.teams.teamA.name,
    current.teams.teamB.name,
    [current.players[0].name, current.players[1].name, current.players[2].name, current.players[3].name],
    current.matchMode,
    starter,
    false
  );

  saveGameState(newState);
  return newState;
}

/**
 * Configura y arranca una NUEVA SERIE desde cero con equipos, jugadores y modalidad.
 */
export function setupNewMatch(
  teamAName: string,
  teamBName: string,
  playerNames: [string, string, string, string],
  matchMode: MatchMode
): GameState {
  const newState = createInitialState(
    teamAName,
    teamBName,
    playerNames,
    matchMode,
    0, // Salidor sin confirmar, se elegirá tocando la mesa
    false
  );
  saveGameState(newState);
  return newState;
}

/**
 * @deprecated Usar setupNewMatch. Mantenida por compatibilidad.
 */
export function setupNewGame(
  teamAName: string,
  teamBName: string,
  playerNames: [string, string, string, string],
  starterSeat: SeatIndex
): GameState {
  return setupNewMatch(teamAName, teamBName, playerNames, 'bo3');
}

/**
 * Actualiza el nombre de un equipo
 */
export function updateTeamName(teamId: TeamId, newName: string): GameState {
  const state = { ...loadGameState() };
  if (state.teams[teamId] && newName.trim().length > 0) {
    state.teams[teamId].name = newName.trim();
    saveGameState(state);
  }
  return state;
}

/**
 * Actualiza el nombre de un jugador
 */
export function updatePlayerName(seat: SeatIndex, newName: string): GameState {
  const state = { ...loadGameState() };
  if (state.players[seat] && newName.trim().length > 0) {
    state.players[seat].name = newName.trim();
    saveGameState(state);
  }
  return state;
}
