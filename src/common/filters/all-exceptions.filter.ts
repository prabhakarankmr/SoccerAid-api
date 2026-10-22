import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { PinoLogger } from 'nestjs-pino';

import { DomainException, ErrorCode } from '../errors';

interface ErrorBody {
  code: ErrorCode | 'VALIDATION_FAILED' | 'INTERNAL_ERROR';
  message: string;
  details?: unknown;
}

const SERVER_ERROR_STATUS_THRESHOLD = 500;

const STATUS_TO_CODE: Partial<Record<number, ErrorBody['code']>> = {
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();

    const { status, body } = this.resolve(exception);

    if (status >= SERVER_ERROR_STATUS_THRESHOLD) {
      this.logger.error({ requestId: request.id, err: exception }, body.message);
    }

    reply.status(status).send({
      error: body,
      meta: { requestId: request.id },
    });
  }

  private resolve(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof DomainException) {
      const response = exception.getResponse() as { message: string; details?: unknown };
      return {
        status: exception.getStatus(),
        body: { code: exception.code, message: response.message, details: response.details },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] }).message ?? exception.message);

      return {
        status,
        body: {
          code: STATUS_TO_CODE[status] ?? 'INTERNAL_ERROR',
          message: Array.isArray(message) ? message.join(', ') : message,
          details: typeof response === 'object' ? response : undefined,
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    };
  }
}
