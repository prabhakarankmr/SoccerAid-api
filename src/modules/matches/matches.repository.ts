import { Injectable } from '@nestjs/common';

import { Match, MatchEventType, MatchStatus, Side } from '../../generated/prisma/client';
import { PrismaService, Tx } from '../../infra/prisma/prisma.service';

const TEAM_REF_SELECT = { id: true, name: true, logoUrl: true, ownerId: true } as const;

export interface TeamRefRow {
  id: string;
  name: string;
  logoUrl: string | null;
  ownerId: string;
}

export interface MatchStateRow {
  homeScore: number;
  awayScore: number;
  clockStartedAt: Date | null;
  clockRunning: boolean;
}

export interface MatchEventRow {
  id: string;
  seq: number;
  type: MatchEventType;
  side: Side | null;
  playerId: string | null;
  payload: unknown;
  matchClockSec: number;
  createdAt: Date;
}

export interface MatchWithTeams extends Match {
  homeTeam: TeamRefRow;
  awayTeam: TeamRefRow;
  lineups: {
    playerId: string;
    side: Side;
    isStarter: boolean;
    isGoalkeeper: boolean;
    slotIndex: number | null;
  }[];
  state: MatchStateRow | null;
  events: MatchEventRow[];
}

// What `POST /matches/:id/events` actually accepts right now (RecordMatchEventDto) — the rest
// of MatchEventType (PASS, CORNER, …) has no writer yet.
type RecordableEventType = Extract<MatchEventType, 'GOAL' | 'SHOT_SAVED' | 'FOUL'>;

function statFieldFor(type: RecordableEventType): 'goals' | 'saves' | 'fouls' {
  if (type === 'GOAL') {
    return 'goals';
  }

  return type === 'SHOT_SAVED' ? 'saves' : 'fouls';
}

export interface LineupEntryInput {
  playerId: string;
  isStarter: boolean;
  isGoalkeeper: boolean;
  slotIndex: number | null;
  posX: number | null;
  posY: number | null;
}

export interface CreateMatchInput {
  homeTeamId: string;
  awayTeamId: string;
  playersPerSide: number;
  formationHome: string;
  formationAway: string;
  halfDurationSec: number;
  extraTimeSec?: number;
  hasPenalties: boolean;
}

@Injectable()
export class MatchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateMatchInput): Promise<MatchWithTeams> {
    return this.prisma.match.create({ data, include: this.includeOpts() });
  }

  findById(id: string): Promise<MatchWithTeams | null> {
    return this.prisma.match.findUnique({ where: { id }, include: this.includeOpts() });
  }

  // Reads the Team row directly (not via TeamsService) — same pattern teams.repository.ts
  // already uses for Player (`include: { player: true }`): a repository traversing another
  // module's Prisma model via a relation/select is fine, it's calling into another module's
  // *service* that's off-limits (BACKEND_INSTRUCTIONS.md module boundary rule).
  findTeamRef(teamId: string): Promise<TeamRefRow | null> {
    return this.prisma.team.findUnique({ where: { id: teamId }, select: TEAM_REF_SELECT });
  }

  async findRosterPlayerIds(teamId: string): Promise<Set<string>> {
    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      select: { playerId: true },
    });
    return new Set(members.map((member) => member.playerId));
  }

  async setLineup(matchId: string, side: Side, entries: LineupEntryInput[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.matchLineup.deleteMany({ where: { matchId, side } }),
      this.prisma.matchLineup.createMany({
        data: entries.map((entry) => ({ matchId, side, ...entry })),
      }),
    ]);
  }

  setStatus(matchId: string, status: MatchStatus): Promise<Match> {
    return this.prisma.match.update({ where: { id: matchId }, data: { status } });
  }

  async update(matchId: string, data: { halfDurationSec?: number }): Promise<MatchWithTeams> {
    await this.prisma.match.update({ where: { id: matchId }, data });
    return this.findByIdOrThrow(matchId);
  }

  // Kickoff: flips LINEUPS_SET → LIVE, starts the server-authoritative clock
  // (`MatchState.clockStartedAt`), and opens the event log with a KICK_OFF row at seq 1.
  // Locked (§3.2 `withMatchLock`) so a double-tap of "Start Match" can't race itself into
  // creating two MatchState rows or two seq-1 events.
  async start(matchId: string, requesterId: string): Promise<MatchWithTeams> {
    await this.prisma.withMatchLock(matchId, async (tx) => {
      const match = await tx.match.findUniqueOrThrow({ where: { id: matchId } });

      if (match.status !== MatchStatus.LIVE) {
        await tx.match.update({
          where: { id: matchId },
          data: { status: MatchStatus.LIVE, lastSeq: 1 },
        });
        await tx.matchState.create({
          data: { matchId, clockStartedAt: new Date(), clockRunning: true, period: 'LIVE' },
        });
        await tx.matchEvent.create({
          data: {
            matchId,
            seq: 1,
            clientEventId: `kickoff:${matchId}`,
            type: MatchEventType.KICK_OFF,
            matchClockSec: 0,
            createdById: requesterId,
          },
        });
      }
    });

    return this.findByIdOrThrow(matchId);
  }

  // Locked (§3.2 `withMatchLock`) so two concurrent requests can't both read the same
  // `lastSeq` and race to insert the same seq — `seq`/`matchClockSec` are computed fresh from
  // inside the lock, not trusted from whatever the caller read before acquiring it.
  async recordEvent(
    matchId: string,
    input: {
      clientEventId: string;
      type: RecordableEventType;
      side: Side;
      playerId: string;
      assistPlayerId: string | null;
      createdById: string;
    },
  ): Promise<MatchWithTeams> {
    await this.prisma.withMatchLock(matchId, async (tx) => {
      // A retried request for the same tap (same clientEventId) is a no-op, not a second goal.
      const existing = await tx.matchEvent.findUnique({
        where: { matchId_clientEventId: { matchId, clientEventId: input.clientEventId } },
      });

      if (existing) {
        return;
      }

      const match = await tx.match.findUniqueOrThrow({
        where: { id: matchId },
        include: { state: { select: { clockStartedAt: true } } },
      });

      if (!match.state?.clockStartedAt) {
        throw new Error('Match is live but has no running clock — MatchState row missing');
      }

      const seq = match.lastSeq + 1;
      const matchClockSec = Math.max(
        0,
        Math.floor((Date.now() - match.state.clockStartedAt.getTime()) / 1000),
      );

      await tx.matchEvent.create({
        data: {
          matchId,
          seq,
          clientEventId: input.clientEventId,
          type: input.type,
          side: input.side,
          playerId: input.playerId,
          payload: input.assistPlayerId ? { assistPlayerId: input.assistPlayerId } : undefined,
          matchClockSec,
          createdById: input.createdById,
        },
      });
      await tx.match.update({ where: { id: matchId }, data: { lastSeq: seq } });
      await this.statUpsert(tx, matchId, input.playerId, input.side, statFieldFor(input.type));

      if (input.type === 'GOAL') {
        await tx.matchState.update({
          where: { matchId },
          data:
            input.side === Side.HOME
              ? { homeScore: { increment: 1 } }
              : { awayScore: { increment: 1 } },
        });

        if (input.assistPlayerId) {
          await this.statUpsert(tx, matchId, input.assistPlayerId, input.side, 'assists');
        }
      }
    });

    return this.findByIdOrThrow(matchId);
  }

  private statUpsert(
    tx: Tx,
    matchId: string,
    playerId: string,
    side: Side,
    stat: 'goals' | 'assists' | 'saves' | 'fouls',
  ) {
    const create =
      stat === 'goals'
        ? { goals: 1 }
        : stat === 'assists'
          ? { assists: 1 }
          : stat === 'saves'
            ? { saves: 1 }
            : { fouls: 1 };
    const update =
      stat === 'goals'
        ? { goals: { increment: 1 } }
        : stat === 'assists'
          ? { assists: { increment: 1 } }
          : stat === 'saves'
            ? { saves: { increment: 1 } }
            : { fouls: { increment: 1 } };

    return tx.playerMatchStat.upsert({
      where: { matchId_playerId: { matchId, playerId } },
      create: { matchId, playerId, side, ...create },
      update,
    });
  }

  private async findByIdOrThrow(matchId: string): Promise<MatchWithTeams> {
    const match = await this.findById(matchId);

    if (!match) {
      throw new Error('Match was updated but could not be reloaded');
    }

    return match;
  }

  private includeOpts() {
    return {
      homeTeam: { select: TEAM_REF_SELECT },
      awayTeam: { select: TEAM_REF_SELECT },
      lineups: {
        select: {
          playerId: true,
          side: true,
          isStarter: true,
          isGoalkeeper: true,
          slotIndex: true,
        },
      },
      state: {
        select: {
          homeScore: true,
          awayScore: true,
          clockStartedAt: true,
          clockRunning: true,
        },
      },
      events: {
        orderBy: { seq: 'asc' },
        select: {
          id: true,
          seq: true,
          type: true,
          side: true,
          playerId: true,
          payload: true,
          matchClockSec: true,
          createdAt: true,
        },
      },
    } as const;
  }
}
