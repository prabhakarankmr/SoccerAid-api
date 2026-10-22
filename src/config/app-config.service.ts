import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

import { EnvironmentVariables, NodeEnv } from './env.schema';

type JwtExpiresIn = NonNullable<JwtModuleOptions['signOptions']>['expiresIn'];

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<EnvironmentVariables, true>) {}

  get nodeEnv(): EnvironmentVariables['NODE_ENV'] {
    return this.configService.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === NodeEnv.Production;
  }

  get port(): number {
    return this.configService.get('PORT', { infer: true });
  }

  get databaseUrl(): string {
    return this.configService.get('DATABASE_URL', { infer: true });
  }

  get redisUrl(): string {
    return this.configService.get('REDIS_URL', { infer: true });
  }

  get jwtAccessSecret(): string {
    return this.configService.get('JWT_ACCESS_SECRET', { infer: true });
  }

  get jwtRefreshSecret(): string {
    return this.configService.get('JWT_REFRESH_SECRET', { infer: true });
  }

  /** `ms`'s duration-string type — env.schema.ts only validates it's a non-empty string. */
  get jwtAccessTtl(): JwtExpiresIn {
    const value = this.configService.get('JWT_ACCESS_TTL', { infer: true });

    return value as JwtExpiresIn;
  }

  get otpProvider(): EnvironmentVariables['OTP_PROVIDER'] {
    return this.configService.get('OTP_PROVIDER', { infer: true });
  }

  get otpApiKey(): string {
    return this.configService.get('OTP_API_KEY', { infer: true });
  }

  get corsOrigins(): string[] {
    const raw = this.configService.get('CORS_ORIGINS', { infer: true });
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  get expoAccessToken(): string | undefined {
    return this.configService.get('EXPO_ACCESS_TOKEN', { infer: true });
  }

  get logLevel(): string {
    return this.configService.get('LOG_LEVEL', { infer: true });
  }
}
