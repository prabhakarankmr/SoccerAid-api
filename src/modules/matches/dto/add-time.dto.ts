import { IsInt, Max, Min } from 'class-validator';

export class AddTimeDto {
  // Capped at 30 min — stoppage time for a half, not a second half's worth of extra play.
  @IsInt()
  @Min(1)
  @Max(1800)
  seconds!: number;
}
