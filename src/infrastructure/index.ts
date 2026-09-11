import { DatabaseModule } from './database';
import { LoggerModule } from './logger';
import { StorageModule } from './storage';
import { ModelModule } from './model/model.module';

export const infrastructure = [
  LoggerModule,
  DatabaseModule,
  StorageModule,
  ModelModule,
];
