import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

// Every key here must be mentioned in BACKEND_INSTRUCTIONS.md §11 (checked by
// scripts/check-instructions.ts in CI).

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export enum OtpProvider {
  MSG91 = 'MSG91',
  TWILIO = 'TWILIO',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;

  @IsString()
  @MinLength(1)
  DIRECT_URL!: string;

  @IsString()
  @MinLength(1)
  REDIS_URL!: string;

  @IsString()
  @MinLength(16)
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(16)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  JWT_ACCESS_TTL = '15m';

  @IsEnum(OtpProvider)
  OTP_PROVIDER: OtpProvider = OtpProvider.MSG91;

  @IsString()
  @MinLength(1)
  OTP_API_KEY!: string;

  // Firebase Admin — verifies the ID token the app gets from Firebase Phone Auth after the user
  // enters the OTP. See §9.5 flag: this is how OTP verification is done for now, OTP_PROVIDER/
  // OTP_API_KEY above are unused until that's revisited.
  @IsString()
  @MinLength(1)
  FIREBASE_PROJECT_ID!: string;

  @IsString()
  @MinLength(1)
  FIREBASE_CLIENT_EMAIL!: string;

  @IsString()
  @MinLength(1)
  FIREBASE_PRIVATE_KEY!: string;

  @IsString()
  CORS_ORIGINS = '';

  @IsOptional()
  @IsString()
  EXPO_ACCESS_TOKEN?: string;

  @IsOptional()
  @IsString()
  LOG_LEVEL = 'info';
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n${errors.toString()}`);
  }

  return validatedConfig;
}
