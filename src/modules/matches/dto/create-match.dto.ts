import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateMatchDto {
  @IsString()
  @MinLength(1)
  homeTeamId!: string;

  @IsString()
  @MinLength(1)
  awayTeamId!: string;

  @IsInt()
  @Min(3)
  @Max(11)
  playersPerSide!: number;

  // Must be one of GET /meta/formations?playersPerSide=N's returned names — checked in the
  // service, not declaratively here (BACKEND_INSTRUCTIONS.md §7.2).
  @IsString()
  @MinLength(1)
  formationHome!: string;

  @IsString()
  @MinLength(1)
  formationAway!: string;

  @IsInt()
  @Min(60)
  halfDurationSec!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  extraTimeSec?: number;

  @IsOptional()
  @IsBoolean()
  hasPenalties?: boolean;
}
