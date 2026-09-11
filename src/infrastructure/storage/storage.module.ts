import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database';
import { SqliteSessionStore } from './sqlite-session-store';
import { SqliteMemoryStore } from './sqlite-memory-store';
import { SqliteRunEventStore } from './sqlite-run-event-store';

@Module({
  imports: [DatabaseModule],
  providers: [SqliteSessionStore, SqliteMemoryStore, SqliteRunEventStore],
  exports: [SqliteSessionStore, SqliteMemoryStore, SqliteRunEventStore],
})
export class StorageModule {}
