import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { PrismaService } from './prisma/prisma.service';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const prismaService = app.get(PrismaService);
  const uploadRoot = resolve(process.cwd(), configService.get<string>('uploadDir', 'uploads'));

  mkdirSync(uploadRoot, { recursive: true });

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cookieParser());
  app.use('/uploads', express.static(uploadRoot));
  app.enableCors({
    origin: configService.get<string[]>('corsOrigin', ['http://localhost:3000']),
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('中国家族姓氏血亲管理系统 API')
    .setDescription('家族成员、血缘图谱、亲戚称呼与权限管理接口')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await prismaService.enableShutdownHooks(app);
  await app.listen(configService.get<number>('port', 3001));
}
void bootstrap();
