import { MatchEventType, MatchStatus } from '../../../generated/prisma/client';
import { MatchPeriod } from '../matches.repository';

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
  // Banked seconds for the CURRENT period — combine with clockRunning/clockStartedAt client-side
  // the same way matches.repository.ts's computeElapsedSec does, to get the live display value.
  elapsedSec: number;
  period: MatchPeriod;
  // Stoppage time (seconds) added to the CURRENT half — the half's effective limit is
  // `halfDurationSec + addedTimeSec`.
  addedTimeSec: number;
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
  // Flattened out of MatchEvent.payload (`{ seconds }`) — only ever set on an ADD_TIME event.
  addedSeconds: number | null;
  matchClockSec: number;
  // Which half/period this event happened in (snapshotted at record time, §4) — null only for
  // historical rows that predate this column.
  period: MatchPeriod | null;
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
  // Whether the requester owns either team — any authenticated user can GET a match (public
  // spectating, §1 Product Overview), but only this lets the frontend show scoring controls
  // instead of a read-only viewer. Computed here rather than exposing homeTeam/awayTeam's raw
  // ownerId, which every other MatchTeamRefEntity read deliberately leaves out.
  canScore: boolean;
}
