import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateMatchDto {
  @IsOptional()
  @IsInt()
  @Min(60)
  halfDurationSec?: number;
}
