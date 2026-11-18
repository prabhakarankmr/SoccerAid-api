import { MatchStatus } from '../../../generated/prisma/client';

import { MatchTeamRefEntity } from './match-detail.entity';

// Lightweight — backs the "Matches" tab's public list (any authenticated user, §1 Product
// Overview: "Let followers watch the match live"), not just the requester's own matches. No
// lineups/events/canScore here; the list is just enough to render a card per match.
export interface MatchSummaryEntity {
  id: string;
  homeTeam: MatchTeamRefEntity;
  awayTeam: MatchTeamRefEntity;
  playersPerSide: number;
  status: MatchStatus;
  homeScore: number;
  awayScore: number;
}
