import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { map, Observable } from 'rxjs';

export interface ResponseEnvelope<T> {
  data: T;
  meta: {
    requestId: string;
    nextCursor?: string;
  };
}

/** Wraps every successful response as `{ data, meta }` per BACKEND_INSTRUCTIONS.md §7.1. */
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, ResponseEnvelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ResponseEnvelope<T>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    return next.handle().pipe(
      map((payload) => {
        if (payload && typeof payload === 'object' && 'data' in payload) {
          return payload as unknown as ResponseEnvelope<T>;
        }

        return {
          data: payload,
          meta: { requestId: request.id },
        };
      }),
    );
  }
}
