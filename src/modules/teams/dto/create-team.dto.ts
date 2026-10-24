import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  // Chosen via GET/POST /players first (search existing, or create a new one by name) — see
  // BACKEND_INSTRUCTIONS.md §5/§7. Not validated for existence here; an invalid id surfaces
  // as a foreign-key error from the TeamMember insert.
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
