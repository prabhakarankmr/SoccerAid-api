import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import { PrismaService } from '../../infra/prisma/prisma.service';

/** Guards match-mutation routes — only an active scorer of the match may write to it (§6.2). */
@Injectable()
export class MatchScorerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest<{ Params: { id: string } }>>();
    const matchId = request.params.id;
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException();
    }

    const scorer = await this.prisma.matchScorer.findUnique({
      where: { matchId_userId: { matchId, userId } },
    });

    if (!scorer?.active) {
      throw new ForbiddenException('You are not an active scorer for this match');
    }

    return true;
  }
}
