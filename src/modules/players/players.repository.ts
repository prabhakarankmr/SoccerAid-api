import { Injectable } from '@nestjs/common';

import { Player } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class PlayersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByPhone(phone: string): Promise<Player | null> {
    return this.prisma.player.findUnique({ where: { phone } });
  }

  findByUserId(userId: string): Promise<Player | null> {
    return this.prisma.player.findUnique({ where: { userId } });
  }

  findById(id: string): Promise<Player | null> {
    return this.prisma.player.findUnique({ where: { id } });
  }

  search(query: string | undefined, limit: number): Promise<Player[]> {
    return this.prisma.player.findMany({
      where: {
        deletedAt: null,
        ...(query ? { displayName: { contains: query, mode: 'insensitive' } } : {}),
      },
      orderBy: { displayName: 'asc' },
      take: limit,
    });
  }

  create(data: {
    displayName: string;
    phone: string;
    userId: string;
    preferredPosition?: string;
    claimedAt: Date;
  }): Promise<Player> {
    return this.prisma.player.create({ data });
  }

  /** A player who isn't (yet) a real app account — e.g. a team captain added by name only. */
  createUnclaimed(displayName: string): Promise<Player> {
    return this.prisma.player.create({ data: { displayName } });
  }

  update(
    id: string,
    data: { displayName?: string; preferredPosition?: string; userId?: string; claimedAt?: Date },
  ): Promise<Player> {
    return this.prisma.player.update({ where: { id }, data });
  }

  // Reads PlayerMatchStat directly (not via MatchesService) — same module-boundary pattern as
  // teams.repository.ts reading Player, matches.repository.ts reading Team: a repository
  // traversing another module's Prisma model via a relation is fine, calling that module's
  // *service* is what's off-limits (BACKEND_INSTRUCTIONS.md module boundary rule). Computed
  // on the fly from the per-match rows rather than maintaining PlayerCareerStat (§4, still
  // unused) — a GROUP BY is simple and always consistent; revisit if this needs to be fast
  // across a huge match history.
  async getMatchStatsTotals(playerId: string): Promise<{
    matchesPlayed: number;
    goals: number;
    assists: number;
    saves: number;
    fouls: number;
  }> {
    const [aggregate, matchesPlayed] = await Promise.all([
      this.prisma.playerMatchStat.aggregate({
        where: { playerId },
        _sum: { goals: true, assists: true, saves: true, fouls: true },
      }),
      this.prisma.playerMatchStat.count({ where: { playerId } }),
    ]);

    return {
      matchesPlayed,
      goals: aggregate._sum.goals ?? 0,
      assists: aggregate._sum.assists ?? 0,
      saves: aggregate._sum.saves ?? 0,
      fouls: aggregate._sum.fouls ?? 0,
    };
  }
}
