import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { RedisIoAdapter } from './modules/live/redis-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });

  const config = app.get(AppConfigService);
  const logger = app.get(Logger);

  app.useLogger(logger);
  app.useWebSocketAdapter(new RedisIoAdapter(app));

  await app.register(fastifyHelmet);
  await app.register(fastifyCors, {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Football Match Tracker API')
    .setDescription('Event-sourced match engine, tournaments and live scoring')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  logger.log(`Application listening on http://localhost:${String(config.port)}`, 'Bootstrap');
}

void bootstrap();
