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
}
