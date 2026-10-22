// Pure domain types — no Nest, no Prisma, no Date.now() (time is passed in). See §6.

export type Side = 'HOME' | 'AWAY';

export type MatchEventType =
  | 'KICK_OFF'
  | 'PASS'
  | 'INTERCEPTION'
  | 'TACKLE'
  | 'BALL_OUT'
  | 'SHOT_ON_TARGET'
  | 'SHOT_OFF_TARGET'
  | 'SHOT_SAVED'
  | 'SHOT_BLOCKED'
  | 'WOODWORK'
  | 'GOAL'
  | 'OWN_GOAL'
  | 'CORNER'
  | 'CORNER_TAKEN'
  | 'CLEARED'
  | 'GOAL_KICK'
  | 'FOUL'
  | 'YELLOW_CARD'
  | 'RED_CARD'
  | 'SUBSTITUTION'
  | 'GK_CHANGE'
  | 'POSSESSION_SET'
  | 'PAUSE'
  | 'RESUME'
  | 'HALF_TIME'
  | 'SECOND_HALF_START'
  | 'FULL_TIME'
  | 'PENALTY_SHOOTOUT_KICK'
  | 'UNDO';

export interface LineupSlot {
  playerId: string;
  side: Side;
  isStarter: boolean;
  isGoalkeeper: boolean;
}

export type Lineup = LineupSlot[];

export interface IncomingEvent {
  type: MatchEventType;
  side?: Side;
  playerId?: string;
  toPlayerId?: string;
  payload?: Record<string, unknown>;
}

export interface MatchEngineState {
  status: string;
  homeScore: number;
  awayScore: number;
  possessionPlayerId?: string;
  possessionSide?: Side;
  clockRunning: boolean;
  elapsedSec: number;
  period: string;
  possessionMsHome: number;
  possessionMsAway: number;
}

export interface StatDelta {
  playerId: string;
  field: string;
  delta: number;
}

export interface DerivedEvent {
  type: MatchEventType;
  side?: Side;
  playerId?: string;
  payload?: Record<string, unknown>;
}

export interface Prompt {
  kind: string;
  options?: string[];
}

export interface DomainError {
  code: string;
  message: string;
}

export interface ApplyResult {
  state: MatchEngineState;
  statDeltas: StatDelta[];
  derivedEvents: DerivedEvent[];
  prompt?: Prompt;
  errors?: DomainError;
}
