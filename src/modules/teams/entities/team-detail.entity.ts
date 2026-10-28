import { TeamSummaryEntity } from './team-summary.entity';

export interface TeamRosterPlayerEntity {
  id: string;
  displayName: string;
  isCaptain: boolean;
  // True for a name-only guest (added via POST /players, no linked User) — can be true for the
  // captain too (a team that isn't on SoccerAid can still be recorded, with a guest captain).
  isGuest: boolean;
}

export interface TeamDetailEntity extends TeamSummaryEntity {
  // Full roster, captain included (first) — `TeamSummaryEntity.captain` stays too, for screens
  // that only need the captain (team list, "Team details" sheet) without the whole roster.
  players: TeamRosterPlayerEntity[];
}
