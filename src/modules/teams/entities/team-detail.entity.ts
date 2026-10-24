import { TeamSummaryEntity } from './team-summary.entity';

export interface TeamRosterPlayerEntity {
  id: string;
  displayName: string;
}

export interface TeamDetailEntity extends TeamSummaryEntity {
  // Non-captain roster — captain is already on `TeamSummaryEntity.captain`, not duplicated here.
  players: TeamRosterPlayerEntity[];
}
