import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsString, MinLength, ValidateNested } from 'class-validator';

export class LineupPlayerDto {
  @IsString()
  @MinLength(1)
  playerId!: string;

  @IsBoolean()
  isStarter!: boolean;

  @IsBoolean()
  isGoalkeeper!: boolean;
}

export class SetLineupsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineupPlayerDto)
  home!: LineupPlayerDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineupPlayerDto)
  away!: LineupPlayerDto[];
}
