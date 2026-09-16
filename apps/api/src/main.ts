import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }).split(','),
    // без credentials браузер не отправит httpOnly cookie с refresh-токеном
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Expense Tracker API')
    .setDescription('API трекера расходов')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  // nestjs-zod строит схемы через z.toJSONSchema(), но результат нужно привести
  // к валидному OpenAPI — этим занимается cleanupOpenApiDoc. Без него SwaggerUI
  // показывает пустые или некорректные модели запросов.
  const openApiDoc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(openApiDoc));

  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  new Logger('Bootstrap').log(`API: http://localhost:${port}/api/v1 · Swagger: /api/docs`);
}

void bootstrap();
