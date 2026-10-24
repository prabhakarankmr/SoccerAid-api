import { randomInt } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';

import { DomainException } from '../../common/errors';
import { TeamRole } from '../../generated/prisma/client';
import { PlayerSummaryEntity } from '../players/entities/player-summary.entity';
import { PlayersService } from '../players/players.service';
import { UsersService } from '../users/users.service';

import { TeamDetailEntity, TeamRosterPlayerEntity } from './entities/team-detail.entity';
import { TeamSummaryEntity } from './entities/team-summary.entity';
import { TeamsRepository } from './teams.repository';

// Excludes visually ambiguous characters (0/O, 1/I/L) — codes get read aloud and typed by
// hand, unlike `id` (a long cuid not meant for that).
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 10;

const INDIA_LOCAL_PHONE = /^[6-9]\d{9}$/;
const INDIA_E164_PHONE = /^\+91[6-9]\d{9}$/;

export interface CreateTeamInput {
  name: string;
  captainPlayerId: string;
  contactNumber?: string;
  place?: string;
  logoUrl?: string;
  ownerId: string;
}

interface TeamWithCaptainMember {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  contactNumber: string | null;
  place: string | null;
  members: { player: { id: string; displayName: string } }[];
}

interface TeamWithRosterMembers {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  contactNumber: string | null;
  place: string | null;
  members: { role: TeamRole; player: { id: string; displayName: string } }[];
}

@Injectable()
export class TeamsService {
  constructor(
    private readonly teamsRepository: TeamsRepository,
    private readonly usersService: UsersService,
    private readonly playersService: PlayersService,
  ) {}

  async createTeam(input: CreateTeamInput): Promise<TeamSummaryEntity> {
    const code = await this.generateUniqueCode();
    const shortName =
      input.name
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 4)
        .toUpperCase() || code.slice(0, 4);

    const team = await this.teamsRepository.createWithCaptain({
      name: input.name,
      shortName,
      code,
      logoUrl: input.logoUrl,
      contactNumber: input.contactNumber,
      place: input.place,
      ownerId: input.ownerId,
      captainPlayerId: input.captainPlayerId,
    });

    if (!team) {
      throw new Error('Team was created but could not be reloaded');
    }

    return this.toSummary(team);
  }

  async searchOwned(ownerId: string, query: string | undefined): Promise<TeamSummaryEntity[]> {
    const teams = await this.teamsRepository.searchOwned(ownerId, query, 30);
    return teams.map((team) => this.toSummary(team));
  }

  async searchOpponents(ownerId: string, query: string | undefined): Promise<TeamSummaryEntity[]> {
    const opponentIds = await this.teamsRepository.findOpponentTeamIds(ownerId);
    const teams = await this.teamsRepository.searchByIds(opponentIds, query, 30);
    return teams.map((team) => this.toSummary(team));
  }

  async getDetail(id: string): Promise<TeamDetailEntity | null> {
    const team = await this.teamsRepository.findByIdWithRoster(id);
    return team ? this.toDetail(team) : null;
  }

  /**
   * Finds a real app User by phone (10-digit local, or full +91 E.164) or by username, and
   * returns their linked Player — not a fuzzy name search like `GET /players?q=` (that one
   * can also match unclaimed, name-only Players; this one can't, by design: a team captain
   * or roster member added this way is always a real account, see BACKEND_INSTRUCTIONS.md §7.2).
   * `null` if no User matches, or if they haven't completed profile-setup yet (no Player).
   */
  async findMemberCandidate(identifier: string): Promise<PlayerSummaryEntity | null> {
    const trimmed = identifier.trim();
    const phone = this.toIndiaE164(trimmed);

    const user = phone
      ? await this.usersService.findByPhone(phone)
      : await this.usersService.findByUsername(trimmed.toLowerCase());

    if (!user) {
      return null;
    }

    const player = await this.playersService.findByUserId(user.id);

    if (!player) {
      return null;
    }

    return {
      id: player.id,
      displayName: player.displayName,
      phone: player.phone,
      preferredPosition: player.preferredPosition,
    };
  }

  async addMember(
    teamId: string,
    requesterId: string,
    playerId: string,
  ): Promise<TeamDetailEntity> {
    await this.assertOwner(teamId, requesterId);
    await this.teamsRepository.addMember(teamId, playerId, TeamRole.PLAYER);
    return this.getDetailOrThrow(teamId);
  }

  async removeMember(
    teamId: string,
    requesterId: string,
    playerId: string,
  ): Promise<TeamDetailEntity> {
    await this.assertOwner(teamId, requesterId);
    await this.teamsRepository.removeMember(teamId, playerId);
    return this.getDetailOrThrow(teamId);
  }

  async setCaptain(
    teamId: string,
    requesterId: string,
    playerId: string,
  ): Promise<TeamDetailEntity> {
    await this.assertOwner(teamId, requesterId);
    await this.teamsRepository.setCaptain(teamId, playerId);
    return this.getDetailOrThrow(teamId);
  }

  private async assertOwner(teamId: string, userId: string): Promise<void> {
    const ownerId = await this.teamsRepository.findOwnerId(teamId);

    if (!ownerId) {
      throw new DomainException('NOT_FOUND', 'Team not found', HttpStatus.NOT_FOUND);
    }

    if (ownerId !== userId) {
      throw new DomainException(
        'FORBIDDEN',
        'Only the team owner can manage its roster',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async getDetailOrThrow(id: string): Promise<TeamDetailEntity> {
    const detail = await this.getDetail(id);

    if (!detail) {
      throw new DomainException('NOT_FOUND', 'Team not found', HttpStatus.NOT_FOUND);
    }

    return detail;
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const candidate = this.randomCode();
      const existing = await this.teamsRepository.findByCode(candidate);

      if (!existing) {
        return candidate;
      }
    }

    throw new Error(
      `Could not generate a unique team code after ${String(MAX_CODE_ATTEMPTS)} attempts`,
    );
  }

  private randomCode(): string {
    let code = '';

    for (let i = 0; i < CODE_LENGTH; i += 1) {
      code += CODE_ALPHABET.charAt(randomInt(CODE_ALPHABET.length));
    }

    return code;
  }

  private toIndiaE164(value: string): string | null {
    if (INDIA_LOCAL_PHONE.test(value)) {
      return `+91${value}`;
    }

    if (INDIA_E164_PHONE.test(value)) {
      return value;
    }

    return null;
  }

  private toSummary(team: TeamWithCaptainMember): TeamSummaryEntity {
    const captainMember = team.members[0];

    return {
      id: team.id,
      name: team.name,
      code: team.code,
      logoUrl: team.logoUrl,
      contactNumber: team.contactNumber,
      place: team.place,
      captain: captainMember
        ? { id: captainMember.player.id, displayName: captainMember.player.displayName }
        : null,
    };
  }

  private toDetail(team: TeamWithRosterMembers): TeamDetailEntity {
    const captainMember = team.members.find((member) => member.role === TeamRole.CAPTAIN);
    const players: TeamRosterPlayerEntity[] = team.members
      .filter((member) => member.role !== TeamRole.CAPTAIN)
      .map((member) => ({ id: member.player.id, displayName: member.player.displayName }));

    return {
      id: team.id,
      name: team.name,
      code: team.code,
      logoUrl: team.logoUrl,
      contactNumber: team.contactNumber,
      place: team.place,
      captain: captainMember
        ? { id: captainMember.player.id, displayName: captainMember.player.displayName }
        : null,
      players,
    };
  }
}
