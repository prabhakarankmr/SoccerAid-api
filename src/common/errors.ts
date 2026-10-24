import { HttpException, HttpStatus } from '@nestjs/common';

// BACKEND_INSTRUCTIONS.md §9.6 — extend here when adding a new error code, and add a row to
// §9.6 in the same change (checked by scripts/check-instructions.ts in CI).
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'MATCH_SEQ_CONFLICT',
  'MATCH_NOT_LIVE',
  'PLAYER_NOT_ON_PITCH',
  'NOT_POSSESSOR',
  'INVALID_STATUS_TRANSITION',
  'LINEUP_INCOMPLETE',
  'SUB_LIMIT_REACHED',
  'NOTHING_TO_UNDO',
  'OTP_INVALID',
  'OTP_RATE_LIMITED',
  'TOURNAMENT_LOCKED',
  'USERNAME_TAKEN',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Domain-rule violation surfaced by a service/engine as `422 { error: { code, message } }`. */
export class DomainException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}
