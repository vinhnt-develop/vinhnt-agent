import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';
import { createSwaggerDocument } from './swagger';
import { VersioningType } from '@nestjs/common';

process.env.TZ = 'UTC';
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const loggerService = app.get(Logger);
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(compression());
  const corsOrigin = configService.get<string>('app.corsOrigin') || 'http://localhost:5173';
  app.enableCors({
    origin: corsOrigin.includes(',') ? corsOrigin.split(',').map((s) => s.trim()) : corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.setGlobalPrefix(configService.get<string>('app.apiPrefix') ?? 'api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' });

  if (configService.get<string>('app.apiDocument') === 'true') {
    createSwaggerDocument(app);
  }

  const port: number = configService.get<number>('app.port') as number;
  const host: string = configService.get<string>('app.host') as string;
  await app.listen(port, host, () => {
    loggerService.log(`vinhnt-agent listening on: ${host}:${port}`);
  });
}
bootstrap();
