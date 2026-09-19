const D = require('better-sqlite3');
const db = new D('./data/agent.db');

// 1. Check agent_runs status
console.log('=== AGENT RUNS STATUS ===');
const runs = db.prepare("SELECT id, session_id, status, model, provider, input_tokens, output_tokens, reasoning_tokens, total_cost, tool_calls_count, started_at, completed_at FROM agent_runs WHERE session_id = '457c6151-89ca-40b1-a32a-3da8cfa3073b' ORDER BY started_at DESC LIMIT 10").all();
runs.forEach(r => console.log(JSON.stringify(r)));

// 2. Check messages for this session
console.log('\n=== MESSAGES (last 5) ===');
const msgs = db.prepare("SELECT id, role, substr(content, 1, 80) as content_preview, model, provider, input_tokens, output_tokens, reasoning_tokens, cost FROM messages WHERE session_id = '457c6151-89ca-40b1-a32a-3da8cfa3073b' ORDER BY created_at DESC LIMIT 5").all();
msgs.forEach(m => console.log(JSON.stringify(m)));

// 3. Check run_events for this session
console.log('\n=== RUN EVENTS (last 10) ===');
const events = db.prepare("SELECT run_id, type, sequence, substr(data, 1, 120) as data_preview FROM run_events WHERE run_id IN (SELECT id FROM agent_runs WHERE session_id = '457c6151-89ca-40b1-a32a-3da8cfa3073b') ORDER BY sequence DESC LIMIT 10").all();
events.forEach(e => console.log(JSON.stringify(e)));

db.close();
