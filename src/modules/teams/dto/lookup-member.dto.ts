import { IsString, MinLength } from 'class-validator';

export class LookupMemberDto {
  // A 10-digit Indian mobile number, +91-prefixed E.164, or a username — TeamsService tries
  // each in turn (§7.2). Not an open-ended search: this must exactly match one real app User,
  // unlike the fuzzy GET /players?q= name search.
  @IsString()
  @MinLength(1)
  identifier!: string;
}
