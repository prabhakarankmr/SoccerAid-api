import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';
import { ConfigModule } from '../../config/config.module';

/**
 * Root BullMQ connection. Feature modules register their own queues with
 * `BullModule.registerQueue({ name: '...' })` and share this connection.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        connection: { url: config.redisUrl, maxRetriesPerRequest: null },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
