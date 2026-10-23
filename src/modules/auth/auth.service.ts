import { randomUUID } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';

import { DomainException } from '../../common/errors';
import { AppConfigService } from '../../config/app-config.service';
import { FirebaseAdminService } from '../../infra/firebase/firebase-admin.service';
import { UsersService } from '../users/users.service';

import { AuthRepository } from './auth.repository';
import { AuthResultEntity, TokenPairEntity } from './entities/auth-result.entity';

// India only, E.164 — Firebase already guarantees E.164 shape, this is the product constraint
// from FRONTEND_INSTRUCTIONS.md (signup is India-only).
const INDIA_PHONE = /^\+91[6-9]\d{9}$/;

interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly usersService: UsersService,
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async verifyFirebaseToken(idToken: string): Promise<AuthResultEntity> {
    const decoded = await this.firebaseAdmin.verifyIdToken(idToken).catch(() => null);
    const phone = decoded?.phone_number;

    if (!phone || !INDIA_PHONE.test(phone)) {
      throw new DomainException(
        'OTP_INVALID',
        'Verification failed or phone number is not a supported Indian number',
        HttpStatus.UNAUTHORIZED,
      );
    }

    let user = await this.usersService.findByPhone(phone);
    const isNewUser = !user;

    user ??= await this.usersService.createByPhone(phone);

    const tokens = await this.issueTokenPair(user.id, phone);

    return {
      ...tokens,
      isNewUser,
      user: { id: user.id, phone: user.phone, name: user.name },
    };
  }

  async refresh(refreshToken: string): Promise<TokenPairEntity> {
    const payload = this.verifyRefreshJwt(refreshToken);
    const row = await this.authRepository.findRefreshTokenById(payload.jti);

    if (!row) {
      throw new DomainException(
        'UNAUTHORIZED',
        'Refresh token not recognised',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (row.revokedAt) {
      // Already-rotated token presented again — treat as theft, kill the whole session.
      await this.authRepository.revokeAllForUser(row.userId);
      throw new DomainException(
        'UNAUTHORIZED',
        'Session revoked — please log in again',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const matches = await argon2.verify(row.tokenHash, refreshToken);

    if (!matches) {
      throw new DomainException(
        'UNAUTHORIZED',
        'Refresh token not recognised',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.usersService.findById(row.userId);

    if (!user) {
      throw new DomainException(
        'UNAUTHORIZED',
        'Refresh token not recognised',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const next = await this.issueTokenPair(user.id, user.phone);
    const nextPayload = jwt.decode(next.refreshToken) as RefreshTokenPayload;
    await this.authRepository.revokeRefreshToken(row.id, nextPayload.jti);

    return next;
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = this.verifyRefreshJwt(refreshToken);
    await this.authRepository.revokeRefreshToken(payload.jti);
  }

  private async issueTokenPair(userId: string, phone: string): Promise<TokenPairEntity> {
    const accessToken = this.jwtService.sign({ sub: userId, phone });

    // Selector/verifier pattern: `jti` is the DB row id (O(1) lookup), the JWT signature over
    // {sub, jti} proves authenticity, and the stored argon2 hash of the *whole* token is an
    // extra check against that one row (§9.5 — cheap here, unlike hashing against every row).
    // The id is minted up front (not Prisma's default) because it has to go inside the JWT
    // before the row exists.
    const jti = randomUUID();
    // Signed with jsonwebtoken directly, not this.jwtService: NestJS's JwtService always
    // merges per-call sign options with the module's global defaults via a plain object
    // spread (@nestjs/jwt's mergeJwtOptions) — a key can be overwritten, not unset, so
    // there's no way to override the global `expiresIn` (the *access* token's 15m TTL) back
    // to "no expiry" through it. Refresh tokens have no TTL by design (§9.5). (Previously
    // tried `expiresIn: undefined` to mean "unset" — jsonwebtoken's validator checks key
    // *presence*, not value, so that threw "expiresIn should be a number... or string".)
    const refreshToken = jwt.sign(
      { sub: userId, jti } satisfies RefreshTokenPayload,
      this.config.jwtRefreshSecret,
    );
    const tokenHash = await argon2.hash(refreshToken);
    await this.authRepository.createRefreshToken(jti, userId, tokenHash);

    return { accessToken, refreshToken };
  }

  private verifyRefreshJwt(refreshToken: string): RefreshTokenPayload {
    try {
      return this.jwtService.verify<RefreshTokenPayload>(refreshToken, {
        secret: this.config.jwtRefreshSecret,
      });
    } catch {
      throw new DomainException(
        'UNAUTHORIZED',
        'Refresh token not recognised',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
