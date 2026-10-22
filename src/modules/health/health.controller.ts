import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheckService, HealthCheck, HealthIndicatorResult } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';

const CHECK_TIMEOUT_MS = 2_000;

/**
 * Runs `probe` under a timeout and reports `{ [key]: { status } }` either way — never throws.
 * A plain thrown/rejected error here would propagate as a 500 (Terminus's executor only
 * aggregates `HealthCheckError`s into the proper 503 response; anything else it re-throws), so
 * a dependency that never responds must resolve to "down", not reject.
 */
function probeWithTimeout(
  key: string,
  probe: () => Promise<void>,
): () => Promise<HealthIndicatorResult> {
  return async () => {
    try {
      await Promise.race([
        probe(),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => {
            reject(new Error('timed out'));
          }, CHECK_TIMEOUT_MS);
        }),
      ]);
      return { [key]: { status: 'up' } };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      return { [key]: { status: 'down', message } };
    }
  };
}

// Both routes are @Public() (no JWT) AND @SkipThrottle() (no rate-limit storage lookup): a
// healthcheck must answer even when the dependency it or the throttler relies on (Redis) is the
// thing that's down — otherwise Railway's own probe at §12.4 hangs instead of reporting unready.
@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  // Railway healthcheck target (§12.4).
  @Public()
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      probeWithTimeout('database', async () => {
        await this.prisma.$queryRaw`SELECT 1`;
      }),
      probeWithTimeout('redis', async () => {
        await this.redis.client.ping();
      }),
    ]);
  }
}
