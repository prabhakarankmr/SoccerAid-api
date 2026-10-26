import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  // Resolved client-side via GET /teams/lookup-member first — a real app user's Player id,
  // found by their exact phone/username (BACKEND_INSTRUCTIONS.md §7.2, §9.5). Not validated
  // for existence here; an invalid id surfaces as a foreign-key error from the TeamMember
  // insert.
  @IsString()
  @MinLength(1)
  captainPlayerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  place?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}
