import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import {
  appConfig,
  databaseConfig,
  agentConfig,
  syncConfig,
} from './constants';
import { validationSchema } from './validations';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      load: [appConfig, databaseConfig, agentConfig, syncConfig],
      validationSchema: validationSchema,
      expandVariables: true,
      cache: true,
    }),
  ],
})
export class ConfigModule {}
