/**
 * Migration script: Move existing DB data to JSON config files.
 *
 * Run: npx tsx scripts/migrate-db-to-json.ts
 *
 * This script:
 * 1. Reads provider_configs, mcp_servers, custom_tools from SQLite
 * 2. Writes non-sensitive fields to JSON config files
 * 3. Creates provider_api_keys table for encrypted API keys
 * 4. Copies encrypted API keys to the new table
 */
import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DB_URL = process.env.DATABASE_URL || 'file:./agent.db';
const CONFIG_DIR = path.join(process.cwd(), 'config');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson<T>(filePath: string): T[] {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

function writeJson<T>(filePath: string, data: T[]) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function main() {
  const dbPath = DB_URL.replace('file:', '');
  const resolvedPath = path.isAbsolute(dbPath)
    ? dbPath
    : path.resolve(process.cwd(), dbPath);

  if (!fs.existsSync(resolvedPath)) {
    console.log(`Database not found at ${resolvedPath}, skipping migration.`);
    return;
  }

  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');

  ensureDir(CONFIG_DIR);

  // ========== 1. Migrate provider_configs ==========
  console.log('Migrating provider_configs...');
  const providers = db.prepare('SELECT * FROM provider_configs WHERE deleted_at IS NULL').all() as any[];
  const providerConfigs = providers.map((p) => ({
    id: p.id,
    provider: p.provider,
    name: p.name || '',
    baseUrl: p.base_url || null,
    defaultModel: p.default_model || null,
    configs: typeof p.configs === 'string' ? JSON.parse(p.configs || '{}') : (p.configs || {}),
    pricing: typeof p.pricing === 'string' ? JSON.parse(p.pricing || '{}') : (p.pricing || {}),
    isActive: p.is_active === 1 || p.is_active === true,
    isDefault: p.is_default === 1 || p.is_default === true,
    createdAt: p.created_at || new Date().toISOString(),
    updatedAt: p.updated_at || new Date().toISOString(),
  }));

  writeJson(path.join(CONFIG_DIR, 'providers.json'), providerConfigs);
  console.log(`  → ${providerConfigs.length} providers written to providers.json`);

  // Create provider_api_keys table
  db.run(`
    CREATE TABLE IF NOT EXISTS provider_api_keys (
      id TEXT PRIMARY KEY,
      api_key TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Copy API keys
  const insertKey = db.prepare('INSERT OR REPLACE INTO provider_api_keys (id, api_key) VALUES (?, ?)');
  for (const p of providers) {
    if (p.api_key) {
      insertKey.run(p.id, p.api_key);
    }
  }
  console.log(`  → ${providers.filter((p: any) => p.api_key).length} API keys copied to provider_api_keys`);

  // ========== 2. Migrate mcp_servers ==========
  console.log('Migrating mcp_servers...');
  const mcpServers = db.prepare('SELECT * FROM mcp_servers WHERE deleted_at IS NULL').all() as any[];
  const mcpConfigs = mcpServers.map((s) => ({
    id: s.id,
    name: s.name,
    transport: s.transport,
    command: s.command || null,
    args: typeof s.args === 'string' ? JSON.parse(s.args || 'null') : s.args || null,
    url: s.url || null,
    env: typeof s.env === 'string' ? JSON.parse(s.env || '{}') : (s.env || {}),
    isEnabled: s.is_enabled === 1 || s.is_enabled === true,
    toolCount: s.tool_count || 0,
    lastConnectedAt: s.last_connected_at || null,
    createdAt: s.created_at || new Date().toISOString(),
    updatedAt: s.updated_at || new Date().toISOString(),
  }));

  writeJson(path.join(CONFIG_DIR, 'mcp-servers.json'), mcpConfigs);
  console.log(`  → ${mcpConfigs.length} MCP servers written to mcp-servers.json`);

  // ========== 3. Migrate custom_tools ==========
  console.log('Migrating custom_tools...');
  const customTools = db.prepare('SELECT * FROM custom_tools WHERE deleted_at IS NULL').all() as any[];
  const customToolConfigs = customTools.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description || null,
    inputSchema: typeof t.input_schema === 'string' ? JSON.parse(t.input_schema || '{}') : (t.input_schema || {}),
    handlerType: t.handler_type || 'webhook',
    handlerConfig: typeof t.handler_config === 'string' ? JSON.parse(t.handler_config || '{}') : (t.handler_config || {}),
    timeoutMs: t.timeout_ms || 30000,
    isActive: t.is_active === 1 || t.is_active === true,
    createdAt: t.created_at || new Date().toISOString(),
    updatedAt: t.updated_at || new Date().toISOString(),
  }));

  writeJson(path.join(CONFIG_DIR, 'custom-tools.json'), customToolConfigs);
  console.log(`  → ${customToolConfigs.length} custom tools written to custom-tools.json`);

  db.close();
  console.log('\nMigration complete! JSON config files are in ./config/');
}

main();
