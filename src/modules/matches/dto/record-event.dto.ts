import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

import { Side } from '../../../generated/prisma/client';

// Scoped to what the live-match screen actually records so far (FRONTEND_INSTRUCTIONS.md §5.3) —
// the full MatchEventType enum (§4) has many more values (PASS, INTERCEPTION, CORNER…) that
// nothing creates yet. Widen this list as more live actions get built, not before.
export const RECORDABLE_EVENT_TYPES = ['GOAL', 'SHOT_SAVED', 'FOUL'] as const;
export type RecordableMatchEventType = (typeof RECORDABLE_EVENT_TYPES)[number];

export class RecordMatchEventDto {
  @IsIn(RECORDABLE_EVENT_TYPES)
  type!: RecordableMatchEventType;

  @IsIn([Side.HOME, Side.AWAY])
  side!: Side;

  @IsString()
  @MinLength(1)
  playerId!: string;

  // GOAL only — the teammate who assisted, if any. Ignored for SHOT_SAVED/FOUL.
  @IsOptional()
  @IsString()
  @MinLength(1)
  assistPlayerId?: string;

  // Device-generated idempotency key (BACKEND_INSTRUCTIONS.md §3.1/§4) — lets a retried request
  // for the same tap dedupe instead of double-counting a goal/save/foul.
  @IsString()
  @MinLength(1)
  clientEventId!: string;
}
