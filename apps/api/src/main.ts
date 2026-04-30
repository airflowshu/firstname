import { Logger, ValidationPipe } from '@nestjs/common';
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
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const prismaService = app.get(PrismaService);
  const nodeEnv = configService.get<string>('nodeEnv', 'development');
  const servePublicUploads = configService.get<boolean>(
    'servePublicUploads',
    nodeEnv !== 'production',
  );
  const enableSwagger = configService.get<boolean>('enableSwagger', nodeEnv !== 'production');
  const uploadRoot = resolve(process.cwd(), configService.get<string>('uploadDir', 'uploads'));

  mkdirSync(uploadRoot, { recursive: true });

  app.getHttpAdapter().getInstance().set('trust proxy', true);
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cookieParser());

  if (servePublicUploads) {
    app.use('/uploads', express.static(uploadRoot));
  } else {
    logger.log('公开上传目录已关闭，/uploads 不再对外静态暴露。');
  }

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

  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('中国家族姓氏血亲管理系统 API')
      .setDescription('家族成员、血缘图谱、亲戚称呼与权限管理接口')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  } else {
    logger.log('Swagger 文档已禁用。');
  }

  await prismaService.enableShutdownHooks(app);
  await app.listen(configService.get<number>('port', 3001));
}
void bootstrap();
