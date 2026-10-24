import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  JsonConfigStore,
  type McpServerJsonConfig,
} from '@/infrastructure/config/json-config-store';
import { McpServerRepository } from './repositories/mcp-server.repository';
import { McpServerService } from './services/mcp-server.service';

describe('McpServerService config persistence', () => {
  let dir: string;
  let service: McpServerService;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vinhnt-mcp-'));
    const store = new JsonConfigStore<McpServerJsonConfig>(
      dir,
      'mcp-servers.json',
    );
    service = new McpServerService(new McpServerRepository(store));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('persists HTTP headers, timeout, and governance on create', async () => {
    const created = await service.create({
      name: 'remote',
      transport: 'streamable-http',
      url: 'http://localhost:3001/mcp',
      headers: { Authorization: 'Bearer test' },
      timeoutMs: 45_000,
      governance: {
        allowedTools: ['read_file'],
        deniedTools: ['delete_file'],
        maxOutputBytes: 65_536,
        spillDir: 'C:/tmp/mcp-spill',
        searchThreshold: 25,
      },
    });

    const loaded = await service.findById(created.id);
    expect(loaded.headers).toEqual({ Authorization: 'Bearer test' });
    expect(loaded.timeoutMs).toBe(45_000);
    expect(loaded.governance).toEqual({
      allowedTools: ['read_file'],
      deniedTools: ['delete_file'],
      maxOutputBytes: 65_536,
      spillDir: 'C:/tmp/mcp-spill',
      searchThreshold: 25,
    });
  });

  it('clears governance with null on update', async () => {
    const created = await service.create({
      name: 'remote',
      transport: 'sse',
      url: 'http://localhost:3001/sse',
      governance: { searchThreshold: 10 },
    });

    const updated = await service.update(created.id, { governance: null });
    expect(updated?.governance).toBeNull();
  });

  it('updates headers and timeout without dropping other fields', async () => {
    const created = await service.create({
      name: 'remote',
      transport: 'sse',
      url: 'http://localhost:3001/sse',
      headers: { Authorization: 'Bearer old' },
      timeoutMs: 30_000,
    });

    const updated = await service.update(created.id, {
      headers: { Authorization: 'Bearer new' },
      timeoutMs: 90_000,
    });

    expect(updated?.url).toBe('http://localhost:3001/sse');
    expect(updated?.headers).toEqual({ Authorization: 'Bearer new' });
    expect(updated?.timeoutMs).toBe(90_000);
  });
});
