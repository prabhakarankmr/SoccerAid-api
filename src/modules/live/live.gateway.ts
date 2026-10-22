import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { DefaultEventsMap, Socket } from 'socket.io';

import { AppConfigService } from '../../config/app-config.service';

interface MatchRoomPayload {
  matchId: string;
}

interface TournamentRoomPayload {
  tournamentId: string;
}

interface LiveSocketData {
  userId?: string;
}

type LiveSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, LiveSocketData>;

// Namespace is NOT under the /api HTTP prefix — see architecture diagram in §3.
@WebSocketGateway({ namespace: '/v1/live', cors: true })
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LiveGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
  ) {}

  handleConnection(client: LiveSocket): void {
    const token = client.handshake.auth.token as string | undefined;

    if (token) {
      try {
        const payload = this.jwtService.verify<{ sub: string }>(token, {
          secret: this.config.jwtAccessSecret,
        });
        client.data.userId = payload.sub;
      } catch {
        // Invalid token — fall through and treat as an anonymous viewer.
      }
    }

    this.logger.debug(
      `client connected ${client.id} (userId=${client.data.userId ?? 'anonymous'})`,
    );
  }

  handleDisconnect(client: LiveSocket): void {
    this.logger.debug(`client disconnected ${client.id}`);
  }

  @SubscribeMessage('match:subscribe')
  handleMatchSubscribe(
    @ConnectedSocket() client: LiveSocket,
    @MessageBody() { matchId }: MatchRoomPayload,
  ): void {
    void client.join(`match:${matchId}`);
  }

  @SubscribeMessage('match:unsubscribe')
  handleMatchUnsubscribe(
    @ConnectedSocket() client: LiveSocket,
    @MessageBody() { matchId }: MatchRoomPayload,
  ): void {
    void client.leave(`match:${matchId}`);
  }

  @SubscribeMessage('tournament:subscribe')
  handleTournamentSubscribe(
    @ConnectedSocket() client: LiveSocket,
    @MessageBody() { tournamentId }: TournamentRoomPayload,
  ): void {
    void client.join(`tournament:${tournamentId}`);
  }
}
