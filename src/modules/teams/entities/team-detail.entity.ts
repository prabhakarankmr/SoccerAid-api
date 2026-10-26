import { TeamSummaryEntity } from './team-summary.entity';

export interface TeamRosterPlayerEntity {
  id: string;
  displayName: string;
  isCaptain: boolean;
  // True for a name-only guest (added via POST /players, no linked User) — never true for the
  // captain, who must always be a real app user (§9.5).
  isGuest: boolean;
}

export interface TeamDetailEntity extends TeamSummaryEntity {
  // Full roster, captain included (first) — `TeamSummaryEntity.captain` stays too, for screens
  // that only need the captain (team list, "Team details" sheet) without the whole roster.
  players: TeamRosterPlayerEntity[];
}
