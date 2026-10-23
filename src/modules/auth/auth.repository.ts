import { Injectable } from '@nestjs/common';

import { RefreshToken } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  createRefreshToken(id: string, userId: string, tokenHash: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data: { id, userId, tokenHash } });
  }

  findRefreshTokenById(id: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { id } });
  }

  revokeRefreshToken(id: string, replacedBy?: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedBy },
    });
  }

  /** Reuse detection (§9.5): a replayed, already-rotated token revokes the whole chain. */
  revokeAllForUser(userId: string): Promise<unknown> {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
