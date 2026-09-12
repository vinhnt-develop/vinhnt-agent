"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const DB_URL = process.env.DATABASE_URL || 'file:./agent.db';
const CONFIG_DIR = path.join(process.cwd(), 'config');
function ensureDir(dir) {
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
}
function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    catch {
        return [];
    }
}
function writeJson(filePath, data) {
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
    const db = new better_sqlite3_1.default(resolvedPath);
    db.pragma('journal_mode = WAL');
    ensureDir(CONFIG_DIR);
    console.log('Migrating provider_configs...');
    const providers = db.prepare('SELECT * FROM provider_configs WHERE deleted_at IS NULL').all();
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
    db.run(`
    CREATE TABLE IF NOT EXISTS provider_api_keys (
      id TEXT PRIMARY KEY,
      api_key TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
    const insertKey = db.prepare('INSERT OR REPLACE INTO provider_api_keys (id, api_key) VALUES (?, ?)');
    for (const p of providers) {
        if (p.api_key) {
            insertKey.run(p.id, p.api_key);
        }
    }
    console.log(`  → ${providers.filter((p) => p.api_key).length} API keys copied to provider_api_keys`);
    console.log('Migrating mcp_servers...');
    const mcpServers = db.prepare('SELECT * FROM mcp_servers WHERE deleted_at IS NULL').all();
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
    console.log('Migrating custom_tools...');
    const customTools = db.prepare('SELECT * FROM custom_tools WHERE deleted_at IS NULL').all();
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
//# sourceMappingURL=migrate-db-to-json.js.map