import { HttpStatus, Injectable } from '@nestjs/common';

import { DomainException } from '../../common/errors';
import { MatchStatus, Side } from '../../generated/prisma/client';
import { getFormationsFor } from '../meta/formations.data';

import { CreateMatchDto } from './dto/create-match.dto';
import { RecordMatchEventDto } from './dto/record-event.dto';
import { LineupPlayerDto, SetLineupsDto } from './dto/set-lineups.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchDetailEntity, MatchEventEntity } from './entities/match-detail.entity';
import { LineupEntryInput, MatchesRepository, MatchWithTeams } from './matches.repository';

function extractAssistPlayerId(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === 'object' &&
    typeof (payload as Record<string, unknown>).assistPlayerId === 'string'
  ) {
    return (payload as Record<string, unknown>).assistPlayerId as string;
  }

  return null;
}

@Injectable()
export class MatchesService {
  constructor(private readonly matchesRepository: MatchesRepository) {}

  async createMatch(dto: CreateMatchDto, requesterId: string): Promise<MatchDetailEntity> {
    if (dto.homeTeamId === dto.awayTeamId) {
      throw new DomainException('VALIDATION_FAILED', 'A team cannot play itself');
    }

    const [home, away] = await Promise.all([
      this.matchesRepository.findTeamRef(dto.homeTeamId),
      this.matchesRepository.findTeamRef(dto.awayTeamId),
    ]);

    if (!home || !away) {
      throw new DomainException('NOT_FOUND', 'Team not found', HttpStatus.NOT_FOUND);
    }

    if (requesterId !== home.ownerId && requesterId !== away.ownerId) {
      throw new DomainException(
        'FORBIDDEN',
        'You must own one of the two teams to set up a match',
        HttpStatus.FORBIDDEN,
      );
    }

    this.assertValidFormation(dto.playersPerSide, dto.formationHome);
    this.assertValidFormation(dto.playersPerSide, dto.formationAway);

    const match = await this.matchesRepository.create({
      homeTeamId: dto.homeTeamId,
      awayTeamId: dto.awayTeamId,
      playersPerSide: dto.playersPerSide,
      formationHome: dto.formationHome,
      formationAway: dto.formationAway,
      halfDurationSec: dto.halfDurationSec,
      extraTimeSec: dto.extraTimeSec,
      hasPenalties: dto.hasPenalties ?? false,
    });

    return this.toDetail(match);
  }

  async getDetail(id: string): Promise<MatchDetailEntity | null> {
    const match = await this.matchesRepository.findById(id);
    return match ? this.toDetail(match) : null;
  }

  async setLineups(
    matchId: string,
    requesterId: string,
    dto: SetLineupsDto,
  ): Promise<MatchDetailEntity> {
    const match = await this.matchesRepository.findById(matchId);

    if (!match) {
      throw new DomainException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
    }

    this.assertOwnsEitherTeam(match, requesterId, 'set its lineup');

    if (match.status !== MatchStatus.SCHEDULED && match.status !== MatchStatus.LINEUPS_SET) {
      throw new DomainException(
        'INVALID_STATUS_TRANSITION',
        'Lineups can only be set before kickoff',
      );
    }

    // A person can be on both teams' rosters in general (e.g. a club with two sides they
    // captain), but not in the SAME match on both sides at once — `@@unique([matchId,
    // playerId])` on MatchLineup enforces this at the DB level too, but that surfaces as an
    // opaque P2002 instead of a clean error if we don't catch it first.
    const homeIds = new Set(dto.home.map((entry) => entry.playerId));
    const overlapping = dto.away.find((entry) => homeIds.has(entry.playerId));

    if (overlapping) {
      throw new DomainException(
        'LINEUP_INCOMPLETE',
        "A player cannot be in both teams' lineups for the same match",
      );
    }

    await this.validateAndSetSide(match, Side.HOME, match.homeTeamId, dto.home);
    await this.validateAndSetSide(match, Side.AWAY, match.awayTeamId, dto.away);
    await this.matchesRepository.setStatus(matchId, MatchStatus.LINEUPS_SET);

    return this.getDetailOrThrow(matchId);
  }

  /** Owner-only, same as lineups — and same status restriction: the half length isn't
   * something you change once a match is actually underway. */
  async updateMatch(
    matchId: string,
    requesterId: string,
    dto: UpdateMatchDto,
  ): Promise<MatchDetailEntity> {
    const match = await this.matchesRepository.findById(matchId);

    if (!match) {
      throw new DomainException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
    }

    this.assertOwnsEitherTeam(match, requesterId, 'edit this match');

    if (match.status !== MatchStatus.SCHEDULED && match.status !== MatchStatus.LINEUPS_SET) {
      throw new DomainException(
        'INVALID_STATUS_TRANSITION',
        'Match settings can only be changed before kickoff',
      );
    }

    const updated = await this.matchesRepository.update(matchId, {
      halfDurationSec: dto.halfDurationSec,
    });

    return this.toDetail(updated);
  }

  // Kickoff — owner-only, same as lineups/settings. No MatchScorer row is created here yet
  // (§4's scorer-transfer model is still unused): anyone who owns either team can both set up
  // and score the match, same single-permission-tier approach the rest of this module uses.
  async startMatch(matchId: string, requesterId: string): Promise<MatchDetailEntity> {
    const match = await this.matchesRepository.findById(matchId);

    if (!match) {
      throw new DomainException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
    }

    this.assertOwnsEitherTeam(match, requesterId, 'start this match');

    if (match.status !== MatchStatus.LINEUPS_SET) {
      throw new DomainException('INVALID_STATUS_TRANSITION', 'Lineups must be set before kickoff');
    }

    const updated = await this.matchesRepository.start(matchId, requesterId);
    return this.toDetail(updated);
  }

  // Scoped to GOAL/SHOT_SAVED/FOUL for now (RecordMatchEventDto) — see that file's comment.
  async recordEvent(
    matchId: string,
    requesterId: string,
    dto: RecordMatchEventDto,
  ): Promise<MatchDetailEntity> {
    const match = await this.matchesRepository.findById(matchId);

    if (!match) {
      throw new DomainException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
    }

    this.assertOwnsEitherTeam(match, requesterId, 'record events for this match');

    if (match.status !== MatchStatus.LIVE) {
      throw new DomainException('MATCH_NOT_LIVE', 'The match must be live to record events');
    }

    const isStarterOnSide = (playerId: string) =>
      match.lineups.some(
        (lineup) => lineup.playerId === playerId && lineup.side === dto.side && lineup.isStarter,
      );

    if (!isStarterOnSide(dto.playerId)) {
      throw new DomainException('PLAYER_NOT_ON_PITCH', 'That player is not a starter on that side');
    }

    if (dto.assistPlayerId) {
      if (dto.assistPlayerId === dto.playerId) {
        throw new DomainException('VALIDATION_FAILED', 'A player cannot assist their own goal');
      }

      if (!isStarterOnSide(dto.assistPlayerId)) {
        throw new DomainException(
          'PLAYER_NOT_ON_PITCH',
          'The assisting player is not a starter on that side',
        );
      }
    }

    // seq and matchClockSec are deliberately not computed here — the repository recomputes
    // both from inside its per-match advisory lock (§3.2 `withMatchLock`) so two concurrent
    // requests can't race each other onto the same seq using a value read before either
    // acquired the lock.
    const updated = await this.matchesRepository.recordEvent(matchId, {
      clientEventId: dto.clientEventId,
      type: dto.type,
      side: dto.side,
      playerId: dto.playerId,
      assistPlayerId: dto.assistPlayerId ?? null,
      createdById: requesterId,
    });

    return this.toDetail(updated);
  }

  private assertOwnsEitherTeam(match: MatchWithTeams, requesterId: string, action: string): void {
    if (requesterId !== match.homeTeam.ownerId && requesterId !== match.awayTeam.ownerId) {
      throw new DomainException(
        'FORBIDDEN',
        `You must own one of the two teams to ${action}`,
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async validateAndSetSide(
    match: MatchWithTeams,
    side: Side,
    teamId: string,
    entries: LineupPlayerDto[],
  ): Promise<void> {
    const ids = entries.map((entry) => entry.playerId);

    if (new Set(ids).size !== ids.length) {
      throw new DomainException('LINEUP_INCOMPLETE', 'Duplicate player in lineup');
    }

    const roster = await this.matchesRepository.findRosterPlayerIds(teamId);
    const notOnRoster = ids.find((id) => !roster.has(id));

    if (notOnRoster) {
      throw new DomainException('LINEUP_INCOMPLETE', "Every player must be on that team's roster");
    }

    const starters = entries.filter((entry) => entry.isStarter);

    if (starters.length !== match.playersPerSide) {
      throw new DomainException(
        'LINEUP_INCOMPLETE',
        `Exactly ${String(match.playersPerSide)} starters are required`,
      );
    }

    const goalkeepers = starters.filter((entry) => entry.isGoalkeeper);

    if (goalkeepers.length !== 1) {
      throw new DomainException('LINEUP_INCOMPLETE', 'Exactly one starting goalkeeper is required');
    }

    const formationName = side === Side.HOME ? match.formationHome : match.formationAway;
    const formation = getFormationsFor(match.playersPerSide).find((f) => f.name === formationName);
    const gkSlot = formation?.slots.find((slot) => slot.isGoalkeeper);
    const outfieldSlots = formation?.slots.filter((slot) => !slot.isGoalkeeper) ?? [];

    // Starters get a default position from the chosen formation (GK → the GK slot, everyone
    // else → outfield slots in submission order) so there's a sane default even before the
    // drag-to-reposition pitch UI exists — not pinned there, just a starting point.
    let outfieldIndex = 0;
    const lineupEntries: LineupEntryInput[] = entries.map((entry) => {
      if (!entry.isStarter) {
        return {
          playerId: entry.playerId,
          isStarter: false,
          isGoalkeeper: entry.isGoalkeeper,
          slotIndex: null,
          posX: null,
          posY: null,
        };
      }

      const slot = entry.isGoalkeeper ? gkSlot : outfieldSlots[outfieldIndex++];

      return {
        playerId: entry.playerId,
        isStarter: true,
        isGoalkeeper: entry.isGoalkeeper,
        slotIndex: slot?.slotIndex ?? null,
        posX: slot?.posX ?? null,
        posY: slot?.posY ?? null,
      };
    });

    await this.matchesRepository.setLineup(match.id, side, lineupEntries);
  }

  private assertValidFormation(playersPerSide: number, formationName: string): void {
    const valid = getFormationsFor(playersPerSide).some((f) => f.name === formationName);

    if (!valid) {
      throw new DomainException(
        'VALIDATION_FAILED',
        `"${formationName}" is not a valid formation for ${String(playersPerSide)}-a-side`,
      );
    }
  }

  private async getDetailOrThrow(id: string): Promise<MatchDetailEntity> {
    const detail = await this.getDetail(id);

    if (!detail) {
      throw new DomainException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
    }

    return detail;
  }

  private toDetail(match: MatchWithTeams): MatchDetailEntity {
    return {
      id: match.id,
      homeTeam: {
        id: match.homeTeam.id,
        name: match.homeTeam.name,
        logoUrl: match.homeTeam.logoUrl,
      },
      awayTeam: {
        id: match.awayTeam.id,
        name: match.awayTeam.name,
        logoUrl: match.awayTeam.logoUrl,
      },
      playersPerSide: match.playersPerSide,
      formationHome: match.formationHome,
      formationAway: match.formationAway,
      halfDurationSec: match.halfDurationSec,
      extraTimeSec: match.extraTimeSec,
      hasPenalties: match.hasPenalties,
      status: match.status,
      lineups: match.lineups.map((lineup) => ({
        playerId: lineup.playerId,
        side: lineup.side,
        isStarter: lineup.isStarter,
        isGoalkeeper: lineup.isGoalkeeper,
        slotIndex: lineup.slotIndex,
      })),
      state: match.state && {
        homeScore: match.state.homeScore,
        awayScore: match.state.awayScore,
        clockStartedAt: match.state.clockStartedAt?.toISOString() ?? null,
        clockRunning: match.state.clockRunning,
      },
      events: match.events.map((event): MatchEventEntity => ({
        id: event.id,
        seq: event.seq,
        type: event.type,
        side: event.side,
        playerId: event.playerId,
        assistPlayerId: extractAssistPlayerId(event.payload),
        matchClockSec: event.matchClockSec,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }
}
