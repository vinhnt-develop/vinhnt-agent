#!/usr/bin/env node
/**
 * Local-only SQLite backup.
 *
 * Uses better-sqlite3's online `db.backup()` (WAL-safe, atomic) instead of
 * copying the file, then verifies the snapshot with PRAGMA integrity_check and
 * prunes old backups by retention. Never touches the network.
 *
 * Usage:  node scripts/backup-db.mjs [--quiet]
 * Env:    DATABASE_URL (default file:./data/agent.db)
 *         DB_BACKUP_RETENTION (default 7)
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { existsSync, mkdirSync, readdirSync, statSync, rmSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";

const quiet = process.argv.includes("--quiet");
const retention = Math.max(1, Number(process.env.DB_BACKUP_RETENTION || 7));

const dbUrl = process.env.DATABASE_URL || "file:./data/agent.db";
const filePath = dbUrl.replace(/^file:/, "");
const resolved = resolve(process.cwd(), filePath);

if (!existsSync(resolved)) {
  if (!quiet) console.log(`[backup] no database at ${resolved} — nothing to back up`);
  process.exit(0);
}

const backupDir = join(dirname(resolved), "backups");
mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const prefix = basename(resolved, ".db");
const dest = join(backupDir, `${prefix}-${stamp}.db`);

const db = new Database(resolved);
try {
  await db.backup(dest);
} finally {
  db.close();
}

const check = new Database(dest, { readonly: true });
let integrity = "unknown";
try {
  integrity = check.pragma("integrity_check", { simple: true });
} finally {
  check.close();
}
if (integrity !== "ok") {
  console.error(`[backup] INTEGRITY CHECK FAILED for ${dest}: ${integrity}`);
  process.exit(1);
}

const backups = readdirSync(backupDir)
  .filter((f) => f.startsWith(`${prefix}-`) && f.endsWith(".db"))
  .map((f) => ({ f, t: statSync(join(backupDir, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);

for (const stale of backups.slice(retention)) {
  rmSync(join(backupDir, stale.f), { force: true });
}

if (!quiet) {
  const kept = Math.min(backups.length, retention);
  console.log(`[backup] OK -> ${dest} (integrity: ok, kept ${kept}/${backups.length})`);
}
