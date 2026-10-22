import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

/** Reads the `Idempotency-Key` header required on retryable mutating requests (§3.1.5). */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const header = request.headers['idempotency-key'];
    return Array.isArray(header) ? header[0] : header;
  },
);
