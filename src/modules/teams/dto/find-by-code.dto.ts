import { IsString, MinLength } from 'class-validator';

export class FindByCodeDto {
  @IsString()
  @MinLength(1)
  code!: string;
}
