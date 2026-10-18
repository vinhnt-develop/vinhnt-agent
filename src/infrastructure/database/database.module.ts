import { Logger, Module } from '@nestjs/common';
import { DATABASE_CONNECTION } from './database-connection';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import path from 'node:path';
import fs from 'node:fs';
import type { DatabaseConnection } from './database.types';
import { prepareMigrations } from './migrate';

const logger = new Logger('DatabaseModule');

@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<DatabaseConnection> => {
        const dbUrl = configService.getOrThrow<string>('database.url');
        // Extract file path from "file:./agent.db" format
        const filePath = dbUrl.replace('file:', '');
        const resolvedPath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(process.cwd(), filePath);

        // Ensure directory exists
        const dir = path.dirname(resolvedPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const sqlite = new Database(resolvedPath);
        // Durability / concurrency tuning for a single local writer (WAL).
        sqlite.pragma('journal_mode = WAL');
        sqlite.pragma('foreign_keys = ON');
        // NORMAL is durable against application crashes (not power loss) and is
        // the recommended pairing with WAL for a local app.
        sqlite.pragma('synchronous = NORMAL');
        // Wait (don't fail) when another connection holds the write lock.
        sqlite.pragma('busy_timeout = 5000');
        // Bound the WAL so it doesn't grow unbounded between checkpoints.
        sqlite.pragma('wal_autocheckpoint = 1000');

        // Use drizzle with schema for type-safe queries
        const db = drizzle(sqlite, { schema });

        // Auto-migrate on boot (idempotent, local-only). Snapshots the DB first
        // when upgrading an already-populated database, so a failed migration is
        // always recoverable without a manual `pnpm db:migrate`.
        const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
        try {
          const plan = await prepareMigrations(sqlite, resolvedPath, migrationsFolder);
          if (plan.pending > 0) {
            migrate(db, { migrationsFolder });
            logger.log(
              `Applied ${plan.pending} migration(s) (${plan.recordedBefore} -> ${plan.total})` +
                (plan.backupPath ? `; pre-migration backup: ${plan.backupPath}` : ''),
            );
          }
        } catch (error) {
          logger.error(
            `Auto-migration failed: ${error instanceof Error ? error.stack : String(error)}`,
          );
          throw error;
        }

        return db;
      },
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
