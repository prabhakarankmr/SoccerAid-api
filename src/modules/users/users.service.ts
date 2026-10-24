import { HttpStatus, Injectable } from '@nestjs/common';

import { DomainException } from '../../common/errors';
import { User } from '../../generated/prisma/client';
import { PlayersService } from '../players/players.service';

import { MeEntity } from './entities/me.entity';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly playersService: PlayersService,
  ) {}

  // Identity lookups for AuthModule — UsersRepository itself is not exported (§5: "no module
  // imports another module's repository, only its exported service").
  findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findByPhone(phone);
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  createByPhone(phone: string): Promise<User> {
    return this.usersRepository.create(phone);
  }

  async getMe(userId: string): Promise<MeEntity> {
    const [user, player] = await Promise.all([
      this.usersRepository.findById(userId),
      this.playersService.findByUserId(userId),
    ]);

    // Guard only: JwtAuthGuard already proved this user exists (it's who signed the token).
    if (!user) {
      throw new Error('Authenticated user not found');
    }

    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      username: user.username,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      player: player
        ? {
            id: player.id,
            displayName: player.displayName,
            preferredPosition: player.preferredPosition,
          }
        : null,
    };
  }

  async updateMe(
    userId: string,
    phone: string,
    input: { displayName: string; username: string; bio?: string; preferredPosition?: string },
  ): Promise<MeEntity> {
    const existing = await this.usersRepository.findByUsername(input.username);

    if (existing && existing.id !== userId) {
      throw new DomainException(
        'USERNAME_TAKEN',
        'That username is already taken',
        HttpStatus.CONFLICT,
      );
    }

    await this.usersRepository.updateProfile(userId, {
      name: input.displayName,
      username: input.username,
      bio: input.bio,
    });
    await this.playersService.upsertForUser({
      userId,
      phone,
      displayName: input.displayName,
      preferredPosition: input.preferredPosition,
    });

    return this.getMe(userId);
  }
}
