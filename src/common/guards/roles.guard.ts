import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';

import { TeamRole } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

/** Guards team-scoped routes with `@Roles(...)` — checks the caller's TeamMember.role (§9.5). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<TeamRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest<{ Params: { id: string } }>>();
    const teamId = request.params.id;
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException();
    }

    const membership = await this.prisma.teamMember.findFirst({
      where: { teamId, player: { userId } },
    });

    if (!membership || !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient team role');
    }

    return true;
  }
}
