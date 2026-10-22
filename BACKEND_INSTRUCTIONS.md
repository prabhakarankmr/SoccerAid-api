# Backend Project Instructions — Football Match Tracker API

> **Read this file before writing any code.** This is the single source of truth for how the backend is built.
> Recommended: keep a copy at the repo root as `CLAUDE.md` / `AGENTS.md` so AI coding tools load it automatically.

---

## 0. Living Document Protocol (MANDATORY)

This file must always describe the code as it actually is. **Any change that introduces a new procedure updates this file in the same commit / PR.** No exceptions.

A "new procedure" is any of:

| Change | Section to update |
|---|---|
| New module / folder under `src/modules` | §5 Module map |
| New endpoint or new API version | §7 API catalogue |
| New WebSocket event | §8 Realtime contract |
| New match event type or change to engine rules | §6 Match engine |
| New Prisma model / enum / index | §4 Data model |
| New env variable | §11 Configuration |
| New script, cron, queue, or deploy step | §12 Deployment |
| New convention, library, or pattern | §9 Coding standards |
| New error code | §9.6 Error codes |

Rules:
1. The PR template has a required checkbox: **"BACKEND_INSTRUCTIONS.md updated (or not needed because …)"**. Reviewers reject PRs that add a procedure without updating this file.
2. Every update adds one line to the **Changelog** at the bottom (date, author, what changed).
3. CI runs `scripts/check-instructions.ts` (see §12.4), which fails the build if a folder in `src/modules/*`, a value of the `MatchEventType` enum, or a key in `env.schema.ts` is not mentioned in this file.
4. AI agents working on this repo: when you add a procedure, edit this file **as part of the same task** — do not wait to be asked.

---

## 1. Product Overview

A universal football (soccer) scoring platform — "CricHeroes for football". Anyone can:

- Create **individual matches** or **tournaments**.
- Choose any format: **3v3 … 11v11** (common: 5v5, 6v6, 7v7, 11v11), with configurable halves, duration, extra time and penalties.
- Score a match **live, event by event** (pass, turnover, shot, goal, corner, foul, substitution …) from a phone.
- Let followers watch the match **live** (score, timeline, possession, stats) in real time.
- Build **lifetime player profiles** — stats aggregate across every match and tournament the player ever plays.
- Get tournament **points tables, fixtures, leaderboards and awards** computed automatically.

### 1.1 What we copy from CricHeroes' architecture (functional analysis)

Based on how CricHeroes behaves as a product (not its internal code):

| CricHeroes concept | Our football equivalent |
|---|---|
| Ball-by-ball scoring is the source of truth; scorecard is derived from it | **Event-by-event log** (`MatchEvent`) is the source of truth; score, stats and timeline are **projections** computed by the backend |
| One "scorer" device per match; scoring can be transferred | `MatchScorer` role per match; scoring lock with transfer endpoint |
| Viewers see live updates instantly | WebSocket rooms per match; server broadcasts after each accepted event |
| Universal player profile identified by phone number; can be added by anyone and claimed later | `Player` profile is global; created by name + optional phone; claimed via OTP |
| Teams are reusable across tournaments | `Team` global; tournaments reference teams; per-tournament squad snapshot |
| Tournaments: league, knockout, groups + knockout; auto points table | `Tournament` with stages, groups, fixtures and backend-computed standings |
| Leaderboards (top run scorers etc.) | Leaderboards: top scorers, assists, clean sheets, passes, saves |
| Offline scoring, syncs later | Client event queue with **idempotency keys**; server dedupes |
| Undo last ball | `UNDO` compensating event — the log is never mutated |

### 1.2 Lessons from the reference project (`E:\football-match-tracker`)

The reference (Next.js) works, but has issues this backend must fix:

- **All match logic lives in the UI** (`match-setup.tsx`, ~2000 lines: stats, score, undo, possession timers). → Move **100%** of it into the backend match engine (§6).
- **Two duplicate schemas** (`Match*` vs `TournamentMatch*`, ~400 lines of copy). → **One** `Match` model; `tournamentId` is nullable.
- Stats are sent in bulk at match end → data lost if the app crashes. → Events are persisted **one at a time**, immediately.
- `team: String // 'A' | 'B'`, `type: String` → use **Prisma enums**.
- Match time computed from client clocks. → **Server-authoritative clock** derived from events.
- No API versioning, no validation layer, no auth on writes. → Fixed below.

---

## 2. Tech Stack (pin exact versions at init)

| Concern | Choice |
|---|---|
| Runtime | Node.js 22 LTS (or the current Active LTS) |
| Framework | **NestJS 11.x** with **`@nestjs/platform-fastify`** |
| ORM | **Prisma 7.x** (`prisma.config.ts`, driver adapter) |
| DB | **Neon Postgres** via `@prisma/adapter-neon` (or `@prisma/adapter-pg` against the pooled URL) |
| Realtime | `@nestjs/websockets` + `@nestjs/platform-socket.io` + `@socket.io/redis-adapter` |
| Cache / pub-sub / rate-limit store | Redis (Railway Redis plugin) |
| Validation | `class-validator` + `class-transformer` (global `ValidationPipe`) |
| Auth | Phone OTP → JWT access (15 min) + rotating refresh token (no TTL — session lasts until logout/revocation, hashed in DB) |
| Docs | `@nestjs/swagger` (OpenAPI 3) — the mobile app generates its client from it |
| Logging | `nestjs-pino` (JSON logs, request id) |
| Security | `@fastify/helmet`, `@fastify/cors`, `@nestjs/throttler` (Redis storage) |
| Health | `@nestjs/terminus` |
| Queue (async jobs) | BullMQ on Redis (notifications, leaderboard rebuilds) |
| Tests | Jest (unit), Supertest/`app.inject` (e2e), Neon branch per CI run |
| Hosting | **Railway** (Dockerfile build), ≥2 replicas |

> Always install with `npm i <pkg>@latest`, then **commit the lockfile with exact versions**. Never use `^` ranges for `@nestjs/*`, `prisma`, `@prisma/*`.

---

## 3. Architecture

```
Mobile app ──HTTPS /api/v1──►  Railway edge (load balancer)
           ──WSS  /v1/live──►        │
                                     ├── API replica 1 (NestJS + Fastify) ─┐
                                     ├── API replica 2                     ├── Redis (pub/sub, rate-limit, cache, BullMQ)
                                     └── API replica N                     ┘
                                                 │
                                                 └── Neon Postgres (pooled endpoint)
                                                       ▲
                                    migrations ────────┘ (direct endpoint, pre-deploy only)
```

### 3.1 Principles

1. **Backend owns all logic.** The client sends *intents* ("player X passed to Y"); the backend validates, applies rules, computes everything, and returns/broadcasts the new state. The client never computes score, stats, standings, timers or awards.
2. **Stateless replicas.** No in-memory state that matters across requests. Anything shared lives in Postgres or Redis. This is what makes load balancing safe.
3. **Event-sourced matches.** `MatchEvent` is append-only. Projections (`MatchState`, `PlayerMatchStat`, `TeamMatchStat`) are updated **in the same DB transaction** as the event insert, and can be rebuilt at any time from the log.
4. **Layering:** `Controller → Service (use-case) → Domain (pure engine) → Repository (Prisma)`. Controllers have zero business logic. Domain code has zero framework/Prisma imports.
5. **Idempotent writes.** Every mutating request that can be retried carries an `Idempotency-Key` header (or `clientEventId` for match events).

### 3.2 Load balancing & horizontal scaling

- Run **≥ 2 replicas** on Railway; Railway's edge distributes HTTP requests across them.
- WebSockets: client uses `transports: ['websocket']` only (no long-polling) so **sticky sessions are not required**. The **Redis adapter** fans out broadcasts to sockets connected on any replica.
- Rate limits, OTP attempts and caches use **Redis**, never process memory.
- **Per-match write serialisation:** two scorers/replicas must not append conflicting events. Use optimistic concurrency: `MatchEvent(matchId, seq)` is `@@unique`; client sends `expectedSeq`; on conflict return `409 MATCH_SEQ_CONFLICT` with the current state. Inside the transaction also take `pg_advisory_xact_lock(hashtext(matchId))`.
- Graceful shutdown: `app.enableShutdownHooks()`; on `SIGTERM` stop accepting connections, finish in-flight requests, close Prisma and Redis.
- DB connections: use Neon's **pooled** (`-pooler`) URL at runtime; keep Prisma pool small per replica (e.g. `connection_limit=5`) so N replicas never exhaust Neon.

---

## 4. Data Model (Prisma)

Single unified schema. Use `cuid2`/`uuid` ids, `@@map` snake_case tables, `createdAt/updatedAt` on every table, enums instead of strings, and indexes for every FK + every list filter.

```prisma
enum Side            { HOME AWAY }                       // replaces 'A' | 'B'
enum MatchStatus     { SCHEDULED LINEUPS_SET LIVE PAUSED HALF_TIME FULL_TIME EXTRA_TIME PENALTIES COMPLETED ABANDONED }
enum TournamentType  { LEAGUE KNOCKOUT GROUPS_KNOCKOUT }
enum MatchEventType  {
  KICK_OFF PASS INTERCEPTION TACKLE BALL_OUT SHOT_ON_TARGET SHOT_OFF_TARGET
  SHOT_SAVED SHOT_BLOCKED WOODWORK GOAL OWN_GOAL CORNER CORNER_TAKEN CLEARED GOAL_KICK
  FOUL YELLOW_CARD RED_CARD SUBSTITUTION GK_CHANGE POSSESSION_SET
  PAUSE RESUME HALF_TIME SECOND_HALF_START FULL_TIME PENALTY_SHOOTOUT_KICK UNDO
}

model User          { id, phone @unique, name, avatarUrl, player Player?, refreshTokens RefreshToken[] }
model Player        { id, displayName, phone? @unique, userId? @unique, claimedAt?, preferredPosition?, ... }
model Team          { id, name, shortName, logoUrl, ownerId, members TeamMember[] }   // name NOT globally unique
model TeamMember    { teamId, playerId, jerseyNo?, role TeamRole, @@unique([teamId, playerId]) }

enum TeamRole       { OWNER CAPTAIN PLAYER }    // TeamMember.role — checked by RolesGuard (§5 common/guards)

model Tournament      { id, name, type TournamentType, playersPerSide Int, rules Json, startDate, ownerId, videoLink? }
model TournamentTeam  { tournamentId, teamId, groupId?, squad TournamentSquadPlayer[] }
model TournamentGroup { id, tournamentId, name }
model Standing        { tournamentId, groupId?, teamId, played, won, drawn, lost, gf, ga, gd, points, form String } // projection

model Match {
  id               String      @id @default(cuid())
  tournamentId     String?     // null = individual (friendly) match
  stage            String?     // "Group A", "QF", "Final"
  homeTeamId       String
  awayTeamId       String
  playersPerSide   Int         // 3..11
  formationHome    String
  formationAway    String
  halfDurationSec  Int
  extraTimeSec     Int?
  hasPenalties     Boolean     @default(false)
  status           MatchStatus @default(SCHEDULED)
  scheduledAt      DateTime?
  lastSeq          Int         @default(0)
  version          Int         @default(0)
  // ...
  @@index([tournamentId, status])
  @@index([status, scheduledAt])
}

model MatchLineup {               // starters + bench, with pitch coordinates (0..100)
  matchId, playerId, side Side, isStarter Boolean, isGoalkeeper Boolean,
  slotIndex Int?, posX Float?, posY Float?, jerseyNo Int?
  @@unique([matchId, playerId])
}

model MatchScorer { matchId, userId, active Boolean, @@unique([matchId, userId]) }

model MatchEvent {                // APPEND-ONLY. Never update/delete rows.
  id            String         @id @default(cuid())
  matchId       String
  seq           Int            // 1,2,3… per match
  clientEventId String         // idempotency key from device
  type          MatchEventType
  side          Side?
  playerId      String?        // actor
  toPlayerId    String?        // receiver / scorer of corner / sub in
  payload       Json?          // e.g. { posX, posY, outcome, assistPlayerId }
  matchClockSec Int            // computed by server, not trusted from client
  voidedBySeq   Int?           // set via UNDO projection (log row itself stays)
  createdById   String
  createdAt     DateTime       @default(now())
  @@unique([matchId, seq])
  @@unique([matchId, clientEventId])
  @@index([matchId, type])
}

model MatchState {                // projection: 1 row per match, what the live screen needs
  matchId @id, homeScore, awayScore, possessionPlayerId?, possessionSide?,
  clockRunning Boolean, clockStartedAt DateTime?, elapsedSec Int, period String,
  possessionMsHome BigInt, possessionMsAway BigInt, updatedAt
}

model PlayerMatchStat {           // projection
  matchId, playerId, side,
  goals, assists, passes, passesReceived, interceptions, tackles, shots, shotsOnTarget,
  shotsOffTarget, saves, blocks, woodwork, cornersWon, cornersTaken, goalKicks,
  fouls, yellowCards, redCards, ballsLost, possessionMs, minutesPlayed
  @@unique([matchId, playerId])
}

model PlayerCareerStat { playerId, scope ("ALL" | tournamentId), ...same counters, matches, wins } // projection
```

Rules:
- Every list query has a supporting index — check with `EXPLAIN` before merging.
- Cascades: deleting a match cascades to its lineup/events/projections. Players/teams are **soft-deleted** (`deletedAt`) because stats reference them.
- Migrations: `prisma migrate dev` locally, **never** edit an applied migration; production uses `prisma migrate deploy` in Railway's pre-deploy step only.
- Prisma 7 generator (`generator client { provider = "prisma-client" }`) emits the client to
  `src/generated/prisma` (gitignored, rebuilt by `prisma generate`/`postinstall`) — import from
  `src/generated/prisma/client`, not `@prisma/client` directly. Connection config lives in
  `prisma.config.ts` (`DIRECT_URL`, used by the CLI for migrations); the running app wires its own
  `@prisma/adapter-neon` instance against `DATABASE_URL` (pooled) in `infra/prisma/prisma.service.ts`.

---

## 5. Module Map (`src/`)

```
src/
  main.ts                    # Fastify adapter, versioning, pipes, filters, swagger, shutdown hooks
  app.module.ts
  config/                    # env.schema.ts (validated), typed ConfigService
  common/
    filters/                 # AllExceptionsFilter → error envelope
    interceptors/            # ResponseEnvelope, Logging, Timeout
    guards/                  # JwtAuthGuard, MatchScorerGuard, RolesGuard
    decorators/              # @CurrentUser, @Public, @IdempotencyKey
    pipes/  dto/ (PaginationQuery, CursorPage)
    utils/
  infra/
    prisma/                  # PrismaService (driver adapter), transaction helper
    redis/                   # RedisService
    queue/                   # BullMQ setup
  modules/
    auth/                    # OTP request/verify, refresh, logout
    users/
    players/                 # global profiles, claim, career stats
    teams/                   # teams & members
    matches/                 # create match, lineups, formations, scorer assignment
    match-engine/            # PURE domain: reducer(state, event) → {state, statDeltas}  ← all scoring rules
    match-events/            # append event use-case, undo, replay/rebuild
    live/                    # WebSocket gateway (namespace /v1/live)
    tournaments/             # tournaments, groups, fixtures generator, standings
    leaderboards/
    meta/                    # formations, supported formats, event-type catalogue
    notifications/           # push (Expo push tokens), BullMQ consumers
    health/
```

Each module: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `dto/`, `entities/` (response shapes), `*.spec.ts`. No module imports another module's repository — only its exported service.

---

## 6. Match Engine (all scoring logic lives here)

`modules/match-engine` is **pure TypeScript** — no Nest, no Prisma, no Date.now() (time is passed in). It must have **≥ 95 % unit-test coverage**.

```ts
apply(state: MatchState, lineup: Lineup, event: IncomingEvent, now: Date)
  : { state: MatchState; statDeltas: StatDelta[]; derivedEvents: DerivedEvent[]; errors?: DomainError }
```

### 6.1 Rules ported from the reference app

| Intent from client | Validation | Effects computed by server |
|---|---|---|
| `KICK_OFF` | lineups complete (= playersPerSide each side, exactly 1 GK) | status→LIVE, clock starts |
| `POSSESSION_SET(player)` (first touch / after restart) | player on pitch | possession → player, possession timer starts |
| `PASS(from→to)` same side | `from` = current possessor, clock running | from.passes+1, to.passesReceived+1, close possession interval for `from` |
| Tap opponent while a player has the ball | — | server responds `needsClassification: INTERCEPTION \| TACKLE` |
| `INTERCEPTION` / `TACKLE (from→to)` | sides differ | to.interceptions/tackles+1, from.ballsLost+1, possession switches |
| `SHOT_OFF_TARGET` | shooter has ball | shots+1, shotsOffTarget+1, derived `GOAL_KICK` → opposing GK goalKicks+1, possession → opposing GK |
| `SHOT_ON_TARGET` → outcome `SAVED` | — | shots+1, onTarget+1, GK saves+1 → then follow-up |
| outcome `BLOCKED(blocker)` | blocker is opponent | blocker.blocks+1 → follow-up |
| outcome `WOODWORK` | — | woodwork+1 → `POSSESSION_SET` prompt |
| follow-up `CORNER` → `CORNER_TAKEN(taker)` | taker same side as attacker | cornersWon (side) +1, taker.cornersTaken+1, possession → taker |
| follow-up `CLEARED` | — | possession prompt |
| `GOAL` | scorer has ball | goals+1, shots+1, onTarget+1, score+1, **assist** = previous same-side PASS into scorer (within the same possession chain), possession → opposing GK (restart) |
| `OWN_GOAL(player)` | — | opposite side score+1, no shot stats |
| `BALL_OUT` | — | possessor.ballsLost+1, possession cleared |
| `FOUL(player)` | on pitch | fouls+1 (optional card) |
| `SUBSTITUTION(out,in)` | out on pitch, in on bench, same side, sub limit | lineup swap; minutesPlayed tracking |
| `GK_CHANGE(player)` | same side | isGoalkeeper moved |
| `PAUSE` / `RESUME` / `HALF_TIME` / `SECOND_HALF_START` / `FULL_TIME` | valid status transition | clock maths, status machine |
| `UNDO` | only last non-voided event (or by `targetSeq` for scorer) | engine **replays** log without voided events → recomputes all projections; never deletes rows |

Possession time = server-measured intervals between possession-changing events while clock is running (pauses excluded).

### 6.2 Append flow (`match-events` service)

```
POST /api/v1/matches/:id/events   { clientEventId, expectedSeq, type, side?, playerId?, toPlayerId?, payload? }
 1. Guard: user is active scorer of match.
 2. If (matchId, clientEventId) exists → return stored result (idempotent replay, 200).
 3. BEGIN; pg_advisory_xact_lock(match); load MatchState + lineup (FOR UPDATE).
 4. If expectedSeq !== lastSeq → 409 MATCH_SEQ_CONFLICT (+ current state).
 5. engine.apply(...) → domain error ⇒ 422 with code.
 6. Insert event(s) seq = lastSeq+1…, upsert projections, bump match.lastSeq/version.
 7. COMMIT.
 8. Publish `match.updated` to Redis → gateway broadcasts to room `match:{id}`.
 9. Enqueue async jobs (career stats, standings if FULL_TIME, push notifications).
10. Return { seq, state, timelineItem, prompt? }   // prompt = next modal the UI must show
```

`prompt` drives the client's modal flow (e.g. `{ kind: 'SHOT_OUTCOME', options: ['SAVED','BLOCKED','WOODWORK'] }`), so even "what question to ask next" is decided by the backend.

### 6.3 Rebuild
`POST /api/v1/admin/matches/:id/rebuild` replays the full log and rewrites projections (used after engine bug fixes). Engine changes that alter stats require a rebuild migration note in the Changelog.

---

## 7. REST API

### 7.1 Conventions
- Prefix `/api`, **URI versioning**: `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })` → `/api/v1/...`.
- Breaking change ⇒ new version (`@Version('2')`) on the affected controller only; v1 kept ≥ 6 months, marked with `Deprecation` + `Sunset` headers.
- Nouns, plural, kebab-case: `/tournaments/:id/fixtures`.
- Response envelope: `{ "data": ..., "meta": { "requestId", "nextCursor"? } }`; errors: `{ "error": { "code", "message", "details"? }, "meta": { "requestId" } }`.
- **Cursor pagination** (`?cursor=&limit=` max 100) for every list.
- `ETag` / `If-None-Match` on GETs of match state & tournament standings.
- Status codes: 200/201/204, 400 validation, 401, 403, 404, 409 conflict, 422 domain rule, 429 throttled, 5xx.
- Every endpoint documented with Swagger decorators (`@ApiTags`, `@ApiOkResponse` with DTO).

### 7.2 Catalogue (v1)

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/otp/request` · `/auth/otp/verify` · `/auth/refresh` · `/auth/logout` | throttled 5/min/phone |
| GET/PATCH | `/me` | |
| GET/POST | `/players` · GET `/players/:id` · GET `/players/:id/stats?scope=` · POST `/players/:id/claim` | search by name/phone |
| GET/POST/PATCH | `/teams` · `/teams/:id` · POST/DELETE `/teams/:id/members` | |
| GET | `/meta/formats` · `/meta/formations?playersPerSide=` | formations & default pitch coordinates (moved from client `lib/formations.ts`) |
| POST | `/matches` | individual or tournament fixture |
| GET | `/matches?status=&tournamentId=&teamId=` · `/matches/:id` | |
| PUT | `/matches/:id/lineups` | starters/bench/GK/positions; server validates counts |
| POST | `/matches/:id/scorers` · `/matches/:id/scorers/transfer` | |
| POST | `/matches/:id/events` | §6.2 |
| POST | `/matches/:id/events/undo` | `{ clientEventId, expectedSeq }` |
| GET | `/matches/:id/state` · `/matches/:id/timeline?cursor=` · `/matches/:id/stats` · `/matches/:id/summary` | summary = awards, key stats, possession % |
| GET/POST/PATCH | `/tournaments` · `/tournaments/:id` | |
| POST | `/tournaments/:id/teams` · `/tournaments/:id/fixtures/generate` | round-robin / bracket generation server-side |
| GET | `/tournaments/:id/standings` · `/tournaments/:id/fixtures` · `/tournaments/:id/leaderboards` | |
| GET | `/leaderboards?metric=goals&scope=` | |
| GET | `/health/live` · `/health/ready` | ready checks DB + Redis |

---

## 8. Realtime Contract (Socket.IO, namespace `/v1/live`)

- Auth: JWT in `auth.token` on handshake (viewers may connect anonymously for public matches).
- Client → server: `match:subscribe {matchId}`, `match:unsubscribe {matchId}`, `tournament:subscribe {tournamentId}`.
- Server → client:
  - `match:state` — full `MatchState` on subscribe.
  - `match:event` — `{ seq, timelineItem, state }` after every accepted event.
  - `match:resync` — sent when a client reports a gap (`lastSeq` mismatch) → client refetches `/state`.
  - `tournament:standings` — after any tournament match reaches FULL_TIME.
- **Writes never go over the socket.** All mutations use REST (validation, idempotency, auth, rate limits all in one place). Sockets only broadcast.
- Gateway is versioned by namespace (`/v2/live` for breaking payload changes).

---

## 9. Coding Standards & Code-Review Rules

### 9.1 General
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`. No `any` (lint error). No non-null `!` without a comment.
- ESLint (typescript-eslint strict + `eslint-plugin-import`) + Prettier; Husky + lint-staged pre-commit; commitlint (Conventional Commits).
- SOLID, small functions (< 40 lines), files < 300 lines (the engine may split by event type: `handlers/pass.handler.ts`…).
- Name things by domain language: `possessor`, `side`, `lineup`, `fixture`, `standing`.
- No magic strings: enums/constants only.
- No `console.log` — inject `PinoLogger`.

### 9.2 Controllers
- Only: parse DTO → call one service method → return entity. No Prisma, no `if` business rules.
- Every route has a guard decision: `@Public()` explicitly, otherwise JWT required.

### 9.3 DTOs & validation
- Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- Separate request DTOs and response entities; never return Prisma models directly (no leaking `phone`, tokens…).

### 9.4 Data access
- Only repositories touch `PrismaService`. Multi-write operations use `prisma.$transaction`.
- `select` only needed columns; avoid N+1 (use `include`/batched `findMany ... in`).
- All money-like counters (stats) are integers; time stored in ms/sec integers.

### 9.5 Security
- Helmet, CORS allow-list, throttler (global 100 req/min/IP; OTP + event endpoints custom), body size limit 100 kb.
  **Temporarily in-memory, not Redis-backed** (`app.module.ts`, `ThrottlerModule.forRoot`) — Redis
  isn't stood up yet (see §11.1 flag below). Per-replica, resets on restart; fine for one instance,
  not for the ≥2-replica production target in §3.2. Swap to `ThrottlerStorageRedisService` (already
  a dependency: `@nest-lab/throttler-storage-redis`) once Redis exists — don't treat this as final.
- **Session policy:** access token short-lived (`JWT_ACCESS_TTL`, 15 min) and invisible to the user —
  the client silently refreshes it in the background. The refresh token itself carries **no TTL**:
  an active user is never forced back to OTP. It ends only via (a) explicit `/auth/logout`
  (`revokedAt` set) or (b) reuse detection — presenting an already-rotated/old refresh token is
  treated as token theft and revokes the whole chain. Uninstalling the app wipes the device's
  stored refresh token, so the next launch naturally requires a fresh OTP login (new token pair) —
  no server-side handling needed for that case. Refresh tokens hashed (argon2), rotated on every use.
- Authorization checks for ownership (tournament owner, team owner, match scorer) in guards/services — never trust client-sent `userId`.
- Secrets only from env; `.env` never committed.

### 9.6 Error codes (extend here when adding)
`VALIDATION_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `MATCH_SEQ_CONFLICT`, `MATCH_NOT_LIVE`, `PLAYER_NOT_ON_PITCH`, `NOT_POSSESSOR`, `INVALID_STATUS_TRANSITION`, `LINEUP_INCOMPLETE`, `SUB_LIMIT_REACHED`, `NOTHING_TO_UNDO`, `OTP_INVALID`, `OTP_RATE_LIMITED`, `TOURNAMENT_LOCKED`.

### 9.7 Testing
- Engine: table-driven unit tests per event type + full-match replay fixtures (`test/fixtures/matches/*.json`) asserting final stats.
- Services: unit tests with mocked repositories.
- E2E: boot app with Fastify `inject`, real Postgres (Neon branch or Docker), covering auth, match lifecycle, idempotency, 409 conflict, undo, standings.
- CI must pass: lint, typecheck, unit, e2e, `prisma validate`, `check-instructions`.

### 9.8 Pull-request checklist (copy into `.github/pull_request_template.md`)
- [ ] Business logic is in service/engine, not controller or client
- [ ] DTO validation + Swagger docs added
- [ ] Endpoint is versioned and follows envelope/pagination conventions
- [ ] Authorization checked
- [ ] Indexes added for new queries; no N+1
- [ ] Tests added/updated; coverage not reduced
- [ ] Migration is additive / backward compatible with the running version
- [ ] No secrets, no `console.log`, no `any`
- [ ] **BACKEND_INSTRUCTIONS.md updated (§0)**

---

## 10. Performance

- Cache hot reads in Redis with short TTL + invalidation on write: `match:state:{id}` (invalidate on event), `tournament:standings:{id}`.
- Leaderboards/career stats rebuilt asynchronously by BullMQ jobs, not in the request path.
- Target: `POST /events` p95 < 150 ms, `GET /state` p95 < 50 ms (cached).
- Compression on for JSON responses > 1 kb.

---

## 11. Configuration (`src/config/env.schema.ts`, validated at boot — app refuses to start on invalid env)

| Var | Purpose |
|---|---|
| `NODE_ENV` | development / test / production |
| `PORT` | Railway injects |
| `DATABASE_URL` | Neon **pooled** URL (runtime) |
| `DIRECT_URL` | Neon **direct** URL (migrations, via `prisma.config.ts`) |
| `REDIS_URL` | Railway Redis |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL` | auth — no `JWT_REFRESH_TTL`: refresh tokens don't expire on a timer, see §9.5 |
| `OTP_PROVIDER`, `OTP_API_KEY` | SMS provider (MSG91 / Twilio) |
| `CORS_ORIGINS` | comma list |
| `EXPO_ACCESS_TOKEN` | push notifications |
| `LOG_LEVEL` | pino level |

### 11.1 🚩 Flag: Redis not stood up yet
No Redis instance exists for local dev or any environment yet (`REDIS_URL` in `.env` is a
placeholder). `RedisModule`/`RedisService` are wired (ioredis, `maxRetriesPerRequest: null` so an
unreachable Redis retries forever instead of crashing the process) but nothing requires them to be
up: the throttler falls back to in-memory storage (§9.5), BullMQ/the Socket.IO Redis adapter just
retry quietly in the background unused. Before relying on multi-replica rate-limiting, BullMQ jobs,
or cross-replica WebSocket broadcast, stand up Redis (Railway plugin, or `docker run -p 6379:6379
redis` locally) and flip the throttler back to Redis-backed storage. Remove this flag once that's done.

---

## 12. Deployment (Railway + Neon)

1. **Build:** multi-stage `Dockerfile` (`npm ci` → `prisma generate` → `nest build` → slim runtime image, non-root user).
2. **Pre-deploy command:** `npx prisma migrate deploy` (runs once per deploy, not per replica).
3. **Start:** `node dist/main.js`, listening on `0.0.0.0:$PORT` (Fastify requires the host).
4. **Healthcheck path:** `/api/v1/health/ready`. Replicas ≥ 2. Enable Railway's restart policy.
5. Environments: `production`, `staging`, and PR previews — each PR preview uses its own **Neon branch**.
6. Migrations must be **expand → migrate → contract** so old and new replicas run side by side during rollout.
7. `railway.toml` at the repo root pins the Dockerfile builder and the healthcheck path; configure the
   pre-deploy command and replica count per-service in the Railway dashboard (not expressible in
   `railway.toml` across all plans).

### 12.4 `scripts/check-instructions.ts`
Reads this file and fails CI if any of these is missing from it: folder names in `src/modules/`, values of `MatchEventType`, keys of `env.schema.ts`, error codes in `common/errors.ts`.

---

## Changelog
| Date | Author | Change |
|---|---|---|
| 2026-10-22 | initial | First version — architecture, engine rules ported from reference app, API v1, realtime contract |
| 2026-10-22 | scaffold | NestJS 11 + Fastify project scaffolded: modular-monolith `src/` layout (§5) wired end-to-end (config, Prisma/Redis/BullMQ infra, global filter/interceptors/guards, Swagger, Socket.IO with Redis adapter, Terminus health checks); `prisma/schema.prisma` for the full §4 data model incl. new `TeamRole` enum; `scripts/check-instructions.ts` implementing §12.4; Dockerfile/railway.toml. All modules are empty placeholders — no business logic (match engine rules, auth flow, etc.) implemented yet. |
| 2026-10-22 | redis-deferred | Flagged Redis as not stood up yet (§11.1); throttler temporarily falls back to in-memory storage (§9.5) instead of hanging requests when Redis is unreachable. AuthModule still unimplemented. |
| 2026-10-22 | session-policy | Decided session lifetime ahead of implementing AuthModule: access token stays short (15 min), refresh token has **no TTL** — ends only via logout or reuse-detection (§9.5). Removed `JWT_REFRESH_TTL` (§11); `RefreshToken.expiresAt` is now nullable (§4). |
