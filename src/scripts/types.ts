export type TeamId = 'teamA' | 'teamB';
export type SeatIndex = 0 | 1 | 2 | 3;
export type MatchMode = 'bo3' | 'bo5';

export interface Player {
  id: number;
  name: string;
  seat: SeatIndex;
  team: TeamId;
}

export interface Team {
  id: TeamId;
  name: string;
  colorName: string;
}

export type TurnDirection = 'counter-clockwise';
export type ExitRule = 'rotation';
export type HandWinType = 'normal' | 'tranca';

export interface GameSettings {
  targetScore: number; // Fijo 100
  direction: TurnDirection; // Fijo antihorario
  exitRule: ExitRule; // Fijo rotación continua
  firstHandStarterSeat: SeatIndex;
}

export interface HandRecord {
  round: number;
  handStarterSeat: SeatIndex;
  winType: HandWinType;
  winnerSeat?: SeatIndex; // Jugador individual si es normal
  winningTeam: TeamId;
  points: number;
  scoreTeamABefore: number;
  scoreTeamBBefore: number;
  scoreTeamAAfter: number;
  scoreTeamBAfter: number;
  timestamp: number;
  nextHandStarterSeat: SeatIndex;
}

export interface GameResult {
  gameNumber: number;
  winnerTeam: TeamId;
  scoreTeamA: number;
  scoreTeamB: number;
  handsPlayed: number;
}

export interface GameState {
  isConfigured: boolean;
  teams: {
    teamA: Team;
    teamB: Team;
  };
  players: [Player, Player, Player, Player];
  settings: GameSettings;

  // Serie (Mejor de 3 / Mejor de 5)
  matchMode: MatchMode;
  gameNumber: number;       // Número de partida actual dentro de la serie (1-based)
  gamesWonTeamA: number;
  gamesWonTeamB: number;
  gameHistory: GameResult[]; // Resultados de partidas anteriores en la serie

  // Estado de la partida actual
  currentRound: number;
  currentHandStarterSeat: SeatIndex;
  starterConfirmed: boolean; // Indica si el salidor fue marcado/confirmado
  scoreTeamA: number;
  scoreTeamB: number;
  history: HandRecord[];
  isFinished: boolean;
  winnerTeam?: TeamId;
  matchWinner?: TeamId;  // Equipo que ganó la serie completa
}
