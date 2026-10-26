import { MatchStatus } from '../../../generated/prisma/client';

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
}
