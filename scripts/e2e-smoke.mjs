#!/usr/bin/env node
/**
 * E2E smoke: gửi tin nhắn qua WS → model gọi write_file → file trên đĩa
 * → tool_executions có dòng → agent_runs.tool_calls_count > 0.
 *
 * Usage: node scripts/e2e-smoke.mjs
 * Env:   SMOKE_BASE_URL (default http://localhost:8080)
 *        SMOKE_TIMEOUT_MS (default 600000)
 *        SMOKE_PROVIDER  (default lm-studio)
 *        SMOKE_MODEL     (default google/gemma-4-12b-qat)
 *
 * Exit 0 = all assertions pass, 1 = any red, 2 = setup/infra failure.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const AGENT_ROOT = path.resolve(path.dirname(__filename), '..');

function loadSocketIo() {
  try {
    return createRequire(import.meta.url)('socket.io-client');
  } catch {
    const webuiPkg = path.resolve(AGENT_ROOT, '..', 'vinhnt-webui', 'package.json');
    if (!fs.existsSync(webuiPkg)) {
      throw new Error('socket.io-client not found (agent nor ../vinhnt-webui)');
    }
    return createRequire(webuiPkg)('socket.io-client');
  }
}

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:8080';
const API = `${BASE}/api/v1`;
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 600_000);
const PROVIDER = process.env.SMOKE_PROVIDER || 'lm-studio';
const MODEL = process.env.SMOKE_MODEL || 'google/gemma-4-12b-qat';
const PROMPT = 'Tạo file index.html chứa chữ hello trong thư mục hiện tại';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(method, pathname, body) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${method} ${pathname} → ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

async function main() {
  const health = await fetch(`${API}/health`).catch(() => null);
  if (!health || !health.ok) {
    console.error(`SETUP FAIL  agent unreachable at ${BASE} (start it first)`);
    process.exit(2);
  }
  console.log(`agent OK    ${BASE}`);

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-smoke-'));
  console.log(`workspace   ${workDir}`);

  // 1. Workspace (POST trả data:null → GET list tìm id)
  await api('POST', '/workspaces', { name: `e2e-smoke-${Date.now()}`, directory: workDir });
  const wsList = await api('GET', '/workspaces?page=1&limit=100');
  const workspace = (wsList.data || []).find(
    (w) => w.directory === workDir || (w.name || '').startsWith('e2e-smoke-'),
  );
  if (!workspace) {
    console.error('SETUP FAIL  workspace created but not found in list');
    process.exit(2);
  }

  // 2. Project (directory = workDir → projectPath = project.directory)
  const project = (
    await api('POST', '/projects', {
      name: 'e2e-project',
      workspaceId: workspace.id,
      directory: workDir,
    })
  ).data;
  if (!project?.id) {
    console.error('SETUP FAIL  project create returned no id');
    process.exit(2);
  }

  // 3. Session
  const session = (
    await api('POST', '/sessions', { title: 'e2e-smoke', projectId: project.id })
  ).data;
  if (!session?.id) {
    console.error('SETUP FAIL  session create returned no id');
    process.exit(2);
  }
  console.log(`session     ${session.id}`);

  // 4. WS run
  const { io } = loadSocketIo();
  const socket = io(`${BASE}/agent`, { transports: ['websocket'], reconnection: false });

  const toolEvents = [];
  const textChunks = [];
  let startedRunId;
  const done = new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ outcome: 'timeout', detail: `no terminal event after ${TIMEOUT_MS}ms` }),
      TIMEOUT_MS,
    );
    const settle = (v) => {
      clearTimeout(timer);
      resolve(v);
    };

    socket.on('connect_error', (err) => settle({ outcome: 'connect_error', error: err.message }));
    socket.on('run:started', (d) => {
      startedRunId = d.runId;
      console.log(`run started ${d.runId}`);
    });
    socket.on('run:event', (e) => {
      if (typeof e?.type === 'string' && e.type.startsWith('tool.')) {
        toolEvents.push(e);
        const extra =
          e.type === 'tool.failed' && e.error
            ? ` error=${typeof e.error === 'string' ? e.error : JSON.stringify(e.error)}`
            : '';
        console.log(`  event ${e.type} ${e.toolName || ''}${extra}`);
      } else if (e?.type === 'text' && e.content) {
        textChunks.push(e.content);
      }
    });
    socket.on('run:completed', (d) => settle({ outcome: 'completed', data: d }));
    socket.on('run:error', (d) => settle({ outcome: 'error', data: d }));
    socket.on('run:cancelled', (d) => settle({ outcome: 'cancelled', data: d }));
  });

  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  }).catch((err) => {
    console.error(`SETUP FAIL  WS connect: ${err.message}`);
    process.exit(2);
  });

  socket.emit('run', {
    sessionId: session.id,
    prompt: PROMPT,
    provider: PROVIDER,
    model: MODEL,
    permissionMode: 'full',
  });

  const result = await done;
  console.log(
    `run outcome ${result.outcome}${result.error ? ` — ${result.error}` : ''}${result.detail ? ` — ${result.detail}` : ''}${result.data?.status ? ` status=${result.data.status}` : ''}`,
  );

  const runId = result.data?.runId || startedRunId;
  socket.disconnect();

  // 5. Assertions — Definition of Done
  const indexPath = path.join(workDir, 'index.html');
  const fileExists = fs.existsSync(indexPath);
  check('file on disk (index.html)', fileExists, fileExists ? indexPath : `missing: ${indexPath}`);

  const wsToolEvents = toolEvents.filter((e) => e.type.startsWith('tool.'));
  check(
    'tool events over WS',
    wsToolEvents.length > 0,
    `${wsToolEvents.length} event(s): ${[...new Set(wsToolEvents.map((e) => `${e.type}:${e.toolName}`))].join(', ') || 'none'}`,
  );

  if (result.outcome !== 'completed') {
    check('run completed', false, `outcome=${result.outcome} ${result.error || result.detail || ''}`);
  } else {
    check('run completed', true, `status=${result.data?.status}`);
  }

  if (runId) {
    let Database = null;
    try {
      Database = createRequire(import.meta.url)('better-sqlite3');
    } catch {
      check('sqlite open', false, 'better-sqlite3 unavailable');
    }
    if (Database) {
      const dbPath = path.join(AGENT_ROOT, 'data', 'agent.db');
      const db = new Database(dbPath, { readonly: true });
      try {
        const run = db.prepare('SELECT status, tool_calls_count FROM agent_runs WHERE id = ?').get(runId);
        check('agent_runs row', !!run, run ? `status=${run.status} tool_calls_count=${run.tool_calls_count}` : `no row for ${runId}`);
        check('tool_calls_count > 0', !!run && (run.tool_calls_count ?? 0) > 0, `got ${run?.tool_calls_count}`);

        const rows = db
          .prepare('SELECT tool_name, status FROM tool_executions WHERE run_id = ?')
          .all(runId);
        check(
          'tool_executions >= 1',
          rows.length > 0,
          `${rows.length} row(s): ${rows.map((r) => `${r.tool_name}/${r.status}`).join(', ') || 'none'}`,
        );
      } finally {
        db.close();
      }
    }
  } else {
    check('agent_runs row', false, 'no runId (run never started)');
    check('tool_calls_count > 0', false, 'no runId');
    check('tool_executions >= 1', false, 'no runId');
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} assertions passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(`SETUP FAIL  ${err.message}`);
  process.exit(2);
});
