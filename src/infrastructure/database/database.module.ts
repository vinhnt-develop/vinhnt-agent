import { Module } from '@nestjs/common';
import { DATABASE_CONNECTION } from './database-connection';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'node:path';
import fs from 'node:fs';
import type { DatabaseConnection } from './database.types';

@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): DatabaseConnection => {
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
        sqlite.pragma('journal_mode = WAL');
        sqlite.pragma('foreign_keys = ON');

        // Use drizzle with schema for type-safe queries
        const db = drizzle(sqlite, { schema });
        return db;
      },
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
