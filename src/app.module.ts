import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { AppConfigService } from './config/app-config.service';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { QueueModule } from './infra/queue/queue.module';
import { RedisModule } from './infra/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { LeaderboardsModule } from './modules/leaderboards/leaderboards.module';
import { LiveModule } from './modules/live/live.module';
import { MatchEventsModule } from './modules/match-events/match-events.module';
import { MatchesModule } from './modules/matches/matches.module';
import { MetaModule } from './modules/meta/meta.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PlayersModule } from './modules/players/players.module';
import { TeamsModule } from './modules/teams/teams.module';
import { TournamentsModule } from './modules/tournaments/tournaments.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.logLevel,
          transport: config.isProduction ? undefined : { target: 'pino-pretty' },
        },
      }),
    }),
    // TODO(redis): §3.2/§9.5 call for Redis-backed throttle storage (shared across replicas) via
    // `@nest-lab/throttler-storage-redis`. Redis isn't stood up yet, so this falls back to the
    // default in-memory storage (per-replica, resets on restart) until it is — swap in
    // `storage: new ThrottlerStorageRedisService(redis.client)` (inject `RedisService`) then.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
    }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.jwtAccessSecret,
        signOptions: { expiresIn: config.jwtAccessTtl },
      }),
    }),
    AuthModule,
    UsersModule,
    PlayersModule,
    TeamsModule,
    MatchesModule,
    MatchEventsModule,
    LiveModule,
    TournamentsModule,
    LeaderboardsModule,
    MetaModule,
    NotificationsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
