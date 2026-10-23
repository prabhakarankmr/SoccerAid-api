import { IsString, MinLength } from 'class-validator';

export class VerifyFirebaseTokenDto {
  @IsString()
  @MinLength(1)
  idToken!: string;
}
