import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server, ServerOptions } from 'socket.io';

import { RedisService } from '../../infra/redis/redis.service';

/**
 * Fans out Socket.IO broadcasts across replicas via Redis pub/sub (§3.2). Clients connect with
 * `transports: ['websocket']` only, so sticky sessions are not required.
 */
export class RedisIoAdapter extends IoAdapter {
  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    const redis = this.app.get(RedisService);
    server.adapter(createAdapter(redis.publisher, redis.createSubscriber()));
    return server;
  }
}
