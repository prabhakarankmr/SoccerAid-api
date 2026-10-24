import { Injectable } from '@nestjs/common';

import { TeamRole } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

const CAPTAIN_INCLUDE = {
  members: {
    where: { role: TeamRole.CAPTAIN },
    include: { player: true },
    take: 1,
  },
} as const;

// Detail view only (not the list queries above) — full roster, not just the captain.
const ROSTER_INCLUDE = {
  members: {
    include: { player: true },
  },
} as const;

@Injectable()
export class TeamsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCode(code: string) {
    return this.prisma.team.findUnique({ where: { code } });
  }

  findById(id: string) {
    return this.prisma.team.findUnique({ where: { id }, include: CAPTAIN_INCLUDE });
  }

  findByIdWithRoster(id: string) {
    return this.prisma.team.findUnique({ where: { id }, include: ROSTER_INCLUDE });
  }

  async findOwnerId(teamId: string): Promise<string | null> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { ownerId: true },
    });
    return team?.ownerId ?? null;
  }

  async addMember(teamId: string, playerId: string, role: TeamRole): Promise<void> {
    await this.prisma.teamMember.upsert({
      where: { teamId_playerId: { teamId, playerId } },
      create: { teamId, playerId, role },
      update: { role },
    });
  }

  async removeMember(teamId: string, playerId: string): Promise<void> {
    await this.prisma.teamMember.deleteMany({ where: { teamId, playerId } });
  }

  /** Demotes any existing captain(s) to PLAYER and promotes `playerId`, in one transaction —
   * a team should never end up with zero or multiple captains mid-request. */
  async setCaptain(teamId: string, playerId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.teamMember.updateMany({
        where: { teamId, role: TeamRole.CAPTAIN },
        data: { role: TeamRole.PLAYER },
      });
      await tx.teamMember.upsert({
        where: { teamId_playerId: { teamId, playerId } },
        create: { teamId, playerId, role: TeamRole.CAPTAIN },
        update: { role: TeamRole.CAPTAIN },
      });
    });
  }

  async createWithCaptain(data: {
    name: string;
    shortName: string;
    code: string;
    logoUrl?: string;
    contactNumber?: string;
    place?: string;
    ownerId: string;
    captainPlayerId: string;
  }) {
    const team = await this.prisma.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: {
          name: data.name,
          shortName: data.shortName,
          code: data.code,
          logoUrl: data.logoUrl,
          contactNumber: data.contactNumber,
          place: data.place,
          ownerId: data.ownerId,
        },
      });
      await tx.teamMember.create({
        data: { teamId: created.id, playerId: data.captainPlayerId, role: TeamRole.CAPTAIN },
      });
      return created;
    });

    return this.findById(team.id);
  }

  searchOwned(ownerId: string, query: string | undefined, limit: number) {
    return this.prisma.team.findMany({
      where: {
        ownerId,
        deletedAt: null,
        ...(query ? this.nameOrCodeFilter(query) : {}),
      },
      include: CAPTAIN_INCLUDE,
      orderBy: { name: 'asc' },
      take: limit,
    });
  }

  /** Teams that have played a Match against any team this owner has — empty until match
   * creation exists and links real fixtures, but the relationship query itself is correct
   * now (BACKEND_INSTRUCTIONS.md §4/§7). */
  async findOpponentTeamIds(ownerId: string): Promise<string[]> {
    const myTeams = await this.prisma.team.findMany({
      where: { ownerId, deletedAt: null },
      select: { id: true },
    });
    const myTeamIds = new Set(myTeams.map((team) => team.id));

    if (myTeamIds.size === 0) {
      return [];
    }

    const matches = await this.prisma.match.findMany({
      where: {
        OR: [
          { homeTeamId: { in: Array.from(myTeamIds) } },
          { awayTeamId: { in: Array.from(myTeamIds) } },
        ],
      },
      select: { homeTeamId: true, awayTeamId: true },
    });

    const opponentIds = new Set<string>();

    for (const match of matches) {
      if (myTeamIds.has(match.homeTeamId) && !myTeamIds.has(match.awayTeamId)) {
        opponentIds.add(match.awayTeamId);
      }

      if (myTeamIds.has(match.awayTeamId) && !myTeamIds.has(match.homeTeamId)) {
        opponentIds.add(match.homeTeamId);
      }
    }

    return Array.from(opponentIds);
  }

  searchByIds(ids: string[], query: string | undefined, limit: number) {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.team.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        ...(query ? this.nameOrCodeFilter(query) : {}),
      },
      include: CAPTAIN_INCLUDE,
      orderBy: { name: 'asc' },
      take: limit,
    });
  }

  private nameOrCodeFilter(query: string) {
    return {
      OR: [
        { name: { contains: query, mode: 'insensitive' as const } },
        { code: { equals: query.toUpperCase() } },
      ],
    };
  }
}
