import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchTeamsDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  q?: string;
}
