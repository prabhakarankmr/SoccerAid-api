import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchPlayersDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  q?: string;
}
