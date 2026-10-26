import { Injectable } from '@nestjs/common';

import { Match, MatchStatus, Side } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

const TEAM_REF_SELECT = { id: true, name: true, logoUrl: true, ownerId: true } as const;

export interface TeamRefRow {
  id: string;
  name: string;
  logoUrl: string | null;
  ownerId: string;
}

export interface MatchWithTeams extends Match {
  homeTeam: TeamRefRow;
  awayTeam: TeamRefRow;
  lineups: {
    playerId: string;
    side: Side;
    isStarter: boolean;
    isGoalkeeper: boolean;
    slotIndex: number | null;
  }[];
}

export interface LineupEntryInput {
  playerId: string;
  isStarter: boolean;
  isGoalkeeper: boolean;
  slotIndex: number | null;
  posX: number | null;
  posY: number | null;
}

export interface CreateMatchInput {
  homeTeamId: string;
  awayTeamId: string;
  playersPerSide: number;
  formationHome: string;
  formationAway: string;
  halfDurationSec: number;
  extraTimeSec?: number;
  hasPenalties: boolean;
}

@Injectable()
export class MatchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateMatchInput): Promise<MatchWithTeams> {
    return this.prisma.match.create({ data, include: this.includeOpts() });
  }

  findById(id: string): Promise<MatchWithTeams | null> {
    return this.prisma.match.findUnique({ where: { id }, include: this.includeOpts() });
  }

  // Reads the Team row directly (not via TeamsService) — same pattern teams.repository.ts
  // already uses for Player (`include: { player: true }`): a repository traversing another
  // module's Prisma model via a relation/select is fine, it's calling into another module's
  // *service* that's off-limits (BACKEND_INSTRUCTIONS.md module boundary rule).
  findTeamRef(teamId: string): Promise<TeamRefRow | null> {
    return this.prisma.team.findUnique({ where: { id: teamId }, select: TEAM_REF_SELECT });
  }

  async findRosterPlayerIds(teamId: string): Promise<Set<string>> {
    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      select: { playerId: true },
    });
    return new Set(members.map((member) => member.playerId));
  }

  async setLineup(matchId: string, side: Side, entries: LineupEntryInput[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.matchLineup.deleteMany({ where: { matchId, side } }),
      this.prisma.matchLineup.createMany({
        data: entries.map((entry) => ({ matchId, side, ...entry })),
      }),
    ]);
  }

  setStatus(matchId: string, status: MatchStatus): Promise<Match> {
    return this.prisma.match.update({ where: { id: matchId }, data: { status } });
  }

  private includeOpts() {
    return {
      homeTeam: { select: TEAM_REF_SELECT },
      awayTeam: { select: TEAM_REF_SELECT },
      lineups: {
        select: {
          playerId: true,
          side: true,
          isStarter: true,
          isGoalkeeper: true,
          slotIndex: true,
        },
      },
    } as const;
  }
}
