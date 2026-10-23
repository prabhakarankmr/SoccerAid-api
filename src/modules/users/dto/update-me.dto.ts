import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  preferredPosition?: string;
}
