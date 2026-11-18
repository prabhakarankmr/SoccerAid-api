import { IsIn } from 'class-validator';

import { Side } from '../../../generated/prisma/client';

export class StartMatchDto {
  // Which team kicks off the first half — no coin toss modeled, just a choice made on the live
  // screen before kickoff (2026-11-17). The second half's kickoff side is derived automatically
  // (whichever team didn't take this one) rather than asked again — see matches.repository.ts's
  // secondHalf().
  @IsIn([Side.HOME, Side.AWAY])
  side!: Side;
}
