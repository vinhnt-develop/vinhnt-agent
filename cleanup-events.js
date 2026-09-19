const Database = require('better-sqlite3');
const db = new Database('data/agent.db');

const before = db.prepare('SELECT type, COUNT(*) as cnt FROM run_events GROUP BY type ORDER BY cnt DESC').all();
console.log('Before:');
before.forEach(r => console.log('  ' + r.type + ': ' + r.cnt));

const d1 = db.prepare("DELETE FROM run_events WHERE type = 'thinking.content'").run();
const d2 = db.prepare("DELETE FROM run_events WHERE type = 'token.streamed'").run();
console.log('Deleted: ' + d1.changes + ' thinking.content, ' + d2.changes + ' token.streamed');

const after = db.prepare('SELECT type, COUNT(*) as cnt FROM run_events GROUP BY type ORDER BY cnt DESC').all();
console.log('After:');
after.forEach(r => console.log('  ' + r.type + ': ' + r.cnt));

db.close();
