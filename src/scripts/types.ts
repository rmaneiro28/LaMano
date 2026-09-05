export type TeamId = 'teamA' | 'teamB';
export type SeatIndex = 0 | 1 | 2 | 3;

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

export type TurnDirection = 'counter-clockwise' | 'clockwise';
export type ExitRule = 'rotation' | 'winner';
export type HandWinType = 'normal' | 'tranca';

export interface GameSettings {
  targetScore: number;
  direction: TurnDirection;
  exitRule: ExitRule;
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

export interface GameState {
  isConfigured: boolean;
  teams: {
    teamA: Team;
    teamB: Team;
  };
  players: [Player, Player, Player, Player];
  settings: GameSettings;
  currentRound: number;
  currentHandStarterSeat: SeatIndex;
  scoreTeamA: number;
  scoreTeamB: number;
  history: HandRecord[];
  isFinished: boolean;
  winnerTeam?: TeamId;
}
