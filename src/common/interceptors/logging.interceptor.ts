import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { PinoLogger } from 'nestjs-pino';
import { Observable, tap } from 'rxjs';

/** Per-handler timing on top of nestjs-pino's request/response access log. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(LoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.debug(
            { requestId: request.id, durationMs: Date.now() - started },
            '%s %s handled',
            request.method,
            request.url,
          );
        },
        error: (error: unknown) => {
          this.logger.debug(
            { requestId: request.id, durationMs: Date.now() - started, error },
            '%s %s failed',
            request.method,
            request.url,
          );
        },
      }),
    );
  }
}
