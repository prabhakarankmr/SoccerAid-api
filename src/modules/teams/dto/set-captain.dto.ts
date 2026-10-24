import { IsString, MinLength } from 'class-validator';

export class SetCaptainDto {
  @IsString()
  @MinLength(1)
  playerId!: string;
}
