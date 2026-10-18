import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { Logger } from '@nestjs/common';
import type BetterSqlite3 from 'better-sqlite3';

const logger = new Logger('DatabaseMigrate');

interface MigrationJournal {
  entries?: Array<{ idx: number; when: number; tag: string }>;
}

export interface MigrationPlan {
  /** Journal entries (the migration chain length). */
  total: number;
  /** Rows already recorded in __drizzle_migrations before this run. */
  recordedBefore: number;
  /** Number of migrations that still need to be applied (> 0 ⇒ migrate). */
  pending: number;
  /** Path of the pre-migration backup, when one was taken. */
  backupPath: string | null;
}

/** Rows recorded in Drizzle's bookkeeping table (0 when the DB is brand new). */
export function countRecordedMigrations(sqlite: BetterSqlite3.Database): number {
  try {
    const row = sqlite
      .prepare('SELECT count(*) AS c FROM __drizzle_migrations')
      .get() as { c: number } | undefined;
    return row?.c ?? 0;
  } catch {
    return 0;
  }
}

function readJournalEntries(migrationsFolder: string): NonNullable<MigrationJournal['entries']> {
  const journalPath = join(migrationsFolder, 'meta', '_journal.json');
  if (!existsSync(journalPath)) {
    return [];
  }
  try {
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as MigrationJournal;
    return journal.entries ?? [];
  } catch (error) {
    logger.warn(`Failed to read migration journal at ${journalPath}: ${error}`);
    return [];
  }
}

/**
 * Online, WAL-safe backup of the open SQLite connection to `<dir>/backups/`,
 * pruning to `DB_BACKUP_RETENTION` (default 7) newest snapshots. Local-only.
 */
export async function backupDatabase(
  sqlite: BetterSqlite3.Database,
  dbPath: string,
  retention = Math.max(1, Number(process.env.DB_BACKUP_RETENTION || 7)),
): Promise<string> {
  const backupDir = join(dirname(dbPath), 'backups');
  mkdirSync(backupDir, { recursive: true });
  const prefix = basename(dbPath, '.db');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = join(backupDir, `${prefix}-${stamp}.db`);

  await sqlite.backup(dest);

  const snapshots = readdirSync(backupDir)
    .filter((file) => file.startsWith(`${prefix}-`) && file.endsWith('.db'))
    .map((file) => ({ file, time: statSync(join(backupDir, file)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  for (const stale of snapshots.slice(retention)) {
    rmSync(join(backupDir, stale.file), { force: true });
  }
  return dest;
}

/**
 * Decide whether the boot migration should run (idempotent, local-only) and,
 * when upgrading an already-populated database, snapshot it first so a failed
 * migration is always recoverable. A fresh DB (no recorded migrations) is
 * migrated directly without a pointless empty snapshot.
 *
 * The caller runs `migrate(db, { migrationsFolder })` when `pending > 0`.
 */
export async function prepareMigrations(
  sqlite: BetterSqlite3.Database,
  dbPath: string,
  migrationsFolder: string,
): Promise<MigrationPlan> {
  const total = readJournalEntries(migrationsFolder).length;
  const recordedBefore = countRecordedMigrations(sqlite);
  const pending = Math.max(0, total - recordedBefore);

  if (total === 0) {
    logger.warn(`No migration journal found at ${migrationsFolder}; skipping auto-migrate`);
    return { total: 0, recordedBefore, pending: 0, backupPath: null };
  }

  let backupPath: string | null = null;
  if (pending > 0 && recordedBefore > 0) {
    backupPath = await backupDatabase(sqlite, dbPath);
  }

  return { total, recordedBefore, pending, backupPath };
}
