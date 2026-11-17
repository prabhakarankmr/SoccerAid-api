import { MatchEventType, MatchStatus } from '../../../generated/prisma/client';

export interface MatchTeamRefEntity {
  id: string;
  name: string;
  logoUrl: string | null;
}

export interface MatchLineupPlayerEntity {
  playerId: string;
  side: 'HOME' | 'AWAY';
  isStarter: boolean;
  isGoalkeeper: boolean;
  slotIndex: number | null;
}

// Projection — null until POST /matches/:id/start (kickoff).
export interface MatchStateEntity {
  homeScore: number;
  awayScore: number;
  clockStartedAt: string | null;
  clockRunning: boolean;
}

export interface MatchEventEntity {
  id: string;
  seq: number;
  type: MatchEventType;
  side: 'HOME' | 'AWAY' | null;
  playerId: string | null;
  // Flattened out of MatchEvent.payload (`{ assistPlayerId }`) for the client's convenience —
  // only ever set on a GOAL event.
  assistPlayerId: string | null;
  matchClockSec: number;
  createdAt: string;
}

export interface MatchDetailEntity {
  id: string;
  homeTeam: MatchTeamRefEntity;
  awayTeam: MatchTeamRefEntity;
  playersPerSide: number;
  formationHome: string;
  formationAway: string;
  halfDurationSec: number;
  extraTimeSec: number | null;
  hasPenalties: boolean;
  status: MatchStatus;
  // Empty until PUT /matches/:id/lineups — a freshly created match has none yet.
  lineups: MatchLineupPlayerEntity[];
  state: MatchStateEntity | null;
  // Ascending by seq (chronological) — oldest first, same order as the underlying log.
  events: MatchEventEntity[];
}
