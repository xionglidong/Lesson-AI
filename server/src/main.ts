import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));
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
