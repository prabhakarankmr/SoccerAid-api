import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class GetFormationsDto {
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(11)
  playersPerSide!: number;
}
