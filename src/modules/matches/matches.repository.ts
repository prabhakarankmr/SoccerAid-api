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

// Mirrors the string literals `start()`/`pause()`/etc. below actually write — MatchState.period
// and MatchEvent.period are a loose `String` column in the schema (§4), typed here instead of
// left as bare strings so a typo can't silently desync the two.
export type MatchPeriod = 'FIRST_HALF' | 'HALF_TIME' | 'SECOND_HALF' | 'FULL_TIME';

export interface MatchStateRow {
  homeScore: number;
  awayScore: number;
  clockStartedAt: Date | null;
  clockRunning: boolean;
  elapsedSec: number;
  period: MatchPeriod;
  addedTimeSec: number;
}

export interface MatchSummaryRow {
  id: string;
  status: MatchStatus;
  playersPerSide: number;
  homeTeam: { id: string; name: string; logoUrl: string | null };
  awayTeam: { id: string; name: string; logoUrl: string | null };
  state: { homeScore: number; awayScore: number } | null;
}

export interface MatchEventRow {
  id: string;
  seq: number;
  type: MatchEventType;
  side: Side | null;
  playerId: string | null;
  payload: unknown;
  matchClockSec: number;
  period: MatchPeriod | null;
  createdAt: Date;
}

// Elapsed seconds for the CURRENT period: banked `elapsedSec` plus however long the clock has
// been running since `clockStartedAt`, or just the banked value while paused/stopped.
function computeElapsedSec(state: {
  clockRunning: boolean;
  clockStartedAt: Date | null;
  elapsedSec: number;
}): number {
  if (!state.clockRunning || !state.clockStartedAt) {
    return state.elapsedSec;
  }

  return (
    state.elapsedSec + Math.max(0, Math.floor((Date.now() - state.clockStartedAt.getTime()) / 1000))
  );
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

  // `period`/`addedTimeSec` cross from the DB's loose `String`/`Int` columns into our narrowed
  // `MatchStateRow`/`MatchEventRow` shapes here — the same cast `loadWithState` does below,
  // just at the two plain-read call sites instead of inside a locked transaction.
  async create(data: CreateMatchInput): Promise<MatchWithTeams> {
    const match = await this.prisma.match.create({ data, include: this.includeOpts() });
    return match as MatchWithTeams;
  }

  async findById(id: string): Promise<MatchWithTeams | null> {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: this.includeOpts(),
    });
    return match as MatchWithTeams | null;
  }

  // Backs the public "Matches" list (any authenticated user, not scoped to the requester's own
  // teams) — a lighter select than findById's, no lineups/events, just enough for a list card.
  findMany(filter: { status?: MatchStatus }): Promise<MatchSummaryRow[]> {
    return this.prisma.match.findMany({
      where: filter.status ? { status: filter.status } : undefined,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        playersPerSide: true,
        homeTeam: { select: { id: true, name: true, logoUrl: true } },
        awayTeam: { select: { id: true, name: true, logoUrl: true } },
        state: { select: { homeScore: true, awayScore: true } },
      },
    });
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

  // Kickoff (first half): flips LINEUPS_SET → LIVE, starts the server-authoritative clock
  // (`MatchState.clockStartedAt`), and opens the event log with a KICK_OFF row at seq 1 —
  // `side` is whichever team the user picked to kick off first (no coin toss modeled, just a
  // choice, 2026-11-17). Locked (§3.2 `withMatchLock`) so a double-tap of "Kick Off" can't race
  // itself into creating two MatchState rows or two seq-1 events.
  async start(matchId: string, requesterId: string, side: Side): Promise<MatchWithTeams> {
    await this.prisma.withMatchLock(matchId, async (tx) => {
      const match = await tx.match.findUniqueOrThrow({ where: { id: matchId } });

      if (match.status !== MatchStatus.LIVE) {
        await tx.match.update({
          where: { id: matchId },
          data: { status: MatchStatus.LIVE, lastSeq: 1 },
        });
        await tx.matchState.create({
          data: {
            matchId,
            clockStartedAt: new Date(),
            clockRunning: true,
            period: 'FIRST_HALF' satisfies MatchPeriod,
            elapsedSec: 0,
            addedTimeSec: 0,
          },
        });
        await tx.matchEvent.create({
          data: {
            matchId,
            seq: 1,
            clientEventId: `kickoff:${matchId}`,
            type: MatchEventType.KICK_OFF,
            side,
            matchClockSec: 0,
            period: 'FIRST_HALF' satisfies MatchPeriod,
            createdById: requesterId,
          },
        });
      }
    });

    return this.findByIdOrThrow(matchId);
  }

  // LIVE → PAUSED: banks the current period's elapsed time and stops the clock.
  async pause(matchId: string, requesterId: string): Promise<MatchWithTeams> {
    await this.prisma.withMatchLock(matchId, async (tx) => {
      const match = await this.loadWithState(tx, matchId);
      const elapsedSec = computeElapsedSec(match.state);
      const seq = match.lastSeq + 1;

      await tx.matchState.update({
        where: { matchId },
        data: { elapsedSec, clockRunning: false, clockStartedAt: null },
      });
      await tx.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.PAUSED, lastSeq: seq },
      });
      await tx.matchEvent.create({
        data: {
          matchId,
          seq,
          clientEventId: `pause:${matchId}:${String(seq)}`,
          type: MatchEventType.PAUSE,
          matchClockSec: elapsedSec,
          period: match.state.period,
          createdById: requesterId,
        },
      });
    });

    return this.findByIdOrThrow(matchId);
  }

  // PAUSED → LIVE: resumes the clock from wherever it was banked, same period.
  async resume(matchId: string, requesterId: string): Promise<MatchWithTeams> {
    await this.prisma.withMatchLock(matchId, async (tx) => {
      const match = await this.loadWithState(tx, matchId);
      const seq = match.lastSeq + 1;

      await tx.matchState.update({
        where: { matchId },
        data: { clockRunning: true, clockStartedAt: new Date() },
      });
      await tx.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.LIVE, lastSeq: seq },
      });
      await tx.matchEvent.create({
        data: {
          matchId,
          seq,
          clientEventId: `resume:${matchId}:${String(seq)}`,
          type: MatchEventType.RESUME,
          matchClockSec: match.state.elapsedSec,
          period: match.state.period,
          createdById: requesterId,
        },
      });
    });

    return this.findByIdOrThrow(matchId);
  }

  // Stoppage/added time for the CURRENT half — extends its effective limit
  // (`halfDurationSec + addedTimeSec`) without touching the running clock itself.
  async addTime(matchId: string, requesterId: string, seconds: number): Promise<MatchWithTeams> {
    await this.prisma.withMatchLock(matchId, async (tx) => {
      const match = await this.loadWithState(tx, matchId);
      const elapsedSec = computeElapsedSec(match.state);
      const seq = match.lastSeq + 1;

      await tx.matchState.update({
        where: { matchId },
        data: { addedTimeSec: { increment: seconds } },
      });
      await tx.match.update({ where: { id: matchId }, data: { lastSeq: seq } });
      await tx.matchEvent.create({
        data: {
          matchId,
          seq,
          clientEventId: `add-time:${matchId}:${String(seq)}`,
          type: MatchEventType.ADD_TIME,
          payload: { seconds },
          matchClockSec: elapsedSec,
          period: match.state.period,
          createdById: requesterId,
        },
      });
    });

    return this.findByIdOrThrow(matchId);
  }

  // Confirmed end of the first half (user-triggered, not automatic — the clock can run past
  // the nominal limit until this is tapped). Resets elapsed/added time for the second half.
  async halfTime(matchId: string, requesterId: string): Promise<MatchWithTeams> {
    await this.prisma.withMatchLock(matchId, async (tx) => {
      const match = await this.loadWithState(tx, matchId);
      const elapsedSec = computeElapsedSec(match.state);
      const seq = match.lastSeq + 1;

      await tx.matchState.update({
        where: { matchId },
        data: {
          period: 'HALF_TIME' satisfies MatchPeriod,
          clockRunning: false,
          clockStartedAt: null,
          elapsedSec: 0,
          addedTimeSec: 0,
        },
      });
      await tx.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.HALF_TIME, lastSeq: seq },
      });
      await tx.matchEvent.create({
        data: {
          matchId,
          seq,
          clientEventId: `half-time:${matchId}:${String(seq)}`,
          type: MatchEventType.HALF_TIME,
          matchClockSec: elapsedSec,
          period: 'FIRST_HALF' satisfies MatchPeriod,
          createdById: requesterId,
        },
      });
    });

    return this.findByIdOrThrow(matchId);
  }

  // Kickoff of the second half — the kickoff action itself is still explicit/user-triggered
  // (same as the first half), but which team takes it isn't asked again: standard football rule
  // is the team that didn't kick off the first half does, so it's derived from the first-half
  // KICK_OFF event rather than re-prompting.
  async secondHalf(matchId: string, requesterId: string): Promise<MatchWithTeams> {
    await this.prisma.withMatchLock(matchId, async (tx) => {
      const match = await tx.match.findUniqueOrThrow({ where: { id: matchId } });
      const seq = match.lastSeq + 1;

      const firstKickoff = await tx.matchEvent.findFirst({
        where: { matchId, type: MatchEventType.KICK_OFF },
        select: { side: true },
      });
      const secondHalfSide =
        firstKickoff?.side === Side.HOME
          ? Side.AWAY
          : firstKickoff?.side === Side.AWAY
            ? Side.HOME
            : null;

      await tx.matchState.update({
        where: { matchId },
        data: {
          period: 'SECOND_HALF' satisfies MatchPeriod,
          clockRunning: true,
          clockStartedAt: new Date(),
          elapsedSec: 0,
        },
      });
      await tx.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.LIVE, lastSeq: seq },
      });
      await tx.matchEvent.create({
        data: {
          matchId,
          seq,
          clientEventId: `second-half:${matchId}:${String(seq)}`,
          type: MatchEventType.SECOND_HALF_START,
          side: secondHalfSide,
          matchClockSec: 0,
          period: 'SECOND_HALF' satisfies MatchPeriod,
          createdById: requesterId,
        },
      });
    });

    return this.findByIdOrThrow(matchId);
  }

  // Manual "End Match" — valid at any live-ish point (mid first half, half-time, mid second
  // half), not only after a full second half. Always the final whistle: there's no separate
  // ABANDONED/COMPLETED step for this scope (§7.2) — one end-state covers both "played out
  // the full second half" and "stopped early."
  async end(matchId: string, requesterId: string): Promise<MatchWithTeams> {
    await this.prisma.withMatchLock(matchId, async (tx) => {
      const match = await this.loadWithState(tx, matchId);
      const elapsedSec = computeElapsedSec(match.state);
      const seq = match.lastSeq + 1;

      await tx.matchState.update({
        where: { matchId },
        data: {
          period: 'FULL_TIME' satisfies MatchPeriod,
          clockRunning: false,
          clockStartedAt: null,
          elapsedSec,
        },
      });
      await tx.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.FULL_TIME, lastSeq: seq },
      });
      await tx.matchEvent.create({
        data: {
          matchId,
          seq,
          clientEventId: `full-time:${matchId}:${String(seq)}`,
          type: MatchEventType.FULL_TIME,
          matchClockSec: elapsedSec,
          period: match.state.period,
          createdById: requesterId,
        },
      });
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

      const match = await this.loadWithState(tx, matchId);
      const seq = match.lastSeq + 1;
      const matchClockSec = computeElapsedSec(match.state);

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
          period: match.state.period,
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

  // Shared by every clock transition (pause/resume/addTime/halfTime/end) — all of them need
  // the match plus its current MatchState, and all require that state to actually exist
  // (can't happen once LIVE, since `start()` always creates it in the same transaction that
  // flips status to LIVE). `period` is narrowed from the DB's loose `String` column here, in
  // one place, rather than at every call site.
  private async loadWithState(tx: Tx, matchId: string): Promise<Match & { state: MatchStateRow }> {
    const match = await tx.match.findUniqueOrThrow({
      where: { id: matchId },
      include: { state: true },
    });

    if (!match.state) {
      throw new Error('Match has no MatchState row — expected one once LIVE');
    }

    return {
      ...match,
      state: {
        homeScore: match.state.homeScore,
        awayScore: match.state.awayScore,
        clockStartedAt: match.state.clockStartedAt,
        clockRunning: match.state.clockRunning,
        elapsedSec: match.state.elapsedSec,
        period: match.state.period as MatchPeriod,
        addedTimeSec: match.state.addedTimeSec,
      },
    };
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
          elapsedSec: true,
          period: true,
          addedTimeSec: true,
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
          period: true,
          payload: true,
          matchClockSec: true,
          createdAt: true,
        },
      },
    } as const;
  }
}
