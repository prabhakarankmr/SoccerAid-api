import { Injectable } from '@nestjs/common';

import { Player } from '../../generated/prisma/client';

import { PlayersRepository } from './players.repository';

export interface UpsertPlayerForUserInput {
  userId: string;
  phone: string;
  displayName: string;
  preferredPosition?: string;
}

@Injectable()
export class PlayersService {
  constructor(private readonly playersRepository: PlayersRepository) {}

  /**
   * Called from the profile-setup step (users.service, PATCH /me). Three cases:
   *  1. This user already has a Player (editing their profile again) → update it.
   *  2. A Player with this phone exists but is unclaimed (someone added them to a team/match
   *     before they ever signed up — see BACKEND_INSTRUCTIONS.md §1.1) → claim it.
   *  3. Neither exists → create a fresh Player.
   */
  async upsertForUser(input: UpsertPlayerForUserInput): Promise<Player> {
    const existingForUser = await this.playersRepository.findByUserId(input.userId);

    if (existingForUser) {
      return this.playersRepository.update(existingForUser.id, {
        displayName: input.displayName,
        preferredPosition: input.preferredPosition,
      });
    }

    const unclaimed = await this.playersRepository.findByPhone(input.phone);

    if (unclaimed) {
      return this.playersRepository.update(unclaimed.id, {
        displayName: input.displayName,
        preferredPosition: input.preferredPosition,
        userId: input.userId,
        claimedAt: new Date(),
      });
    }

    return this.playersRepository.create({
      displayName: input.displayName,
      phone: input.phone,
      userId: input.userId,
      preferredPosition: input.preferredPosition,
      claimedAt: new Date(),
    });
  }

  findByUserId(userId: string): Promise<Player | null> {
    return this.playersRepository.findByUserId(userId);
  }
}
