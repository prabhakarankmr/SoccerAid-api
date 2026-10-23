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

  create(data: {
    displayName: string;
    phone: string;
    userId: string;
    preferredPosition?: string;
    claimedAt: Date;
  }): Promise<Player> {
    return this.prisma.player.create({ data });
  }

  update(
    id: string,
    data: { displayName?: string; preferredPosition?: string; userId?: string; claimedAt?: Date },
  ): Promise<Player> {
    return this.prisma.player.update({ where: { id }, data });
  }
}
