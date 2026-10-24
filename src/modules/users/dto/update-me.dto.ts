import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateMeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName!: string;

  // Lowercase-only by design, not just convention — the DB unique constraint on
  // User.username is case-sensitive (no citext), so restricting the charset here is what
  // actually makes "username taken" checks behave as users expect (no Alice/alice split).
  @IsString()
  @Matches(/^[a-z0-9_]{3,20}$/, {
    message: 'Username must be 3-20 characters: lowercase letters, numbers, underscores only',
  })
  username!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  preferredPosition?: string;
}
