import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const bodyLimit = process.env.BODY_LIMIT || '512mb';
  app.use(express.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: bodyLimit }));
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });
  await app.listen(config.port);
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${config.port}`);
}

bootstrap();
