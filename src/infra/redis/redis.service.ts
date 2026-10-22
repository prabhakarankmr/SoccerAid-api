import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  /** General-purpose client: cache reads/writes, rate-limit counters. */
  public readonly client: Redis;

  /** Dedicated publisher — ioredis blocks a connection used for SUBSCRIBE from issuing other commands. */
  public readonly publisher: Redis;

  constructor(config: AppConfigService) {
    // `maxRetriesPerRequest: null` — this is a long-lived app connection, not a one-shot
    // script: retry indefinitely with backoff instead of throwing (and crashing the process)
    // after a handful of failed attempts (ioredis's documented recommendation; same setting
    // BullMQ requires of its own connection in infra/queue/queue.module.ts).
    this.client = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
    this.publisher = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  }

  onModuleInit(): void {
    this.client.on('error', (error) => {
      this.logger.error(error, 'Redis client error');
    });
    this.publisher.on('error', (error) => {
      this.logger.error(error, 'Redis publisher error');
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.client.quit(), this.publisher.quit()]);
  }

  createSubscriber(): Redis {
    return this.client.duplicate();
  }
}
