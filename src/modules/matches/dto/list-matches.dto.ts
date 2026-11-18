import { IsIn, IsOptional } from 'class-validator';

import { MatchStatus } from '../../../generated/prisma/client';

export class ListMatchesDto {
  @IsOptional()
  @IsIn(Object.values(MatchStatus))
  status?: MatchStatus;
}
