import db from './db.js';
import { signals as fixtureSignals } from './fixture-loader.js';

const existing = db.prepare('SELECT COUNT(*) AS n FROM signals').get();

if (existing.n > 0) {
  console.log(`[seed] signals table already has ${existing.n} rows — skipping seed.`);
  console.log(`[seed] To force reseed, delete data/inbox.db and run again.`);
  process.exit(0);
}

console.log(`[seed] Empty DB. Loading up to ${fixtureSignals.length} signals from fixture...`);

const insert = db.prepare(`
  INSERT OR IGNORE INTO signals (
    id, match_key, type, date, time, title, detected_on,
    attendees, projects, summary, expected_files, notes, status, sources, source
  ) VALUES (
    @id, @match_key, @type, @date, @time, @title, @detected_on,
    @attendees, @projects, @summary, @expected_files, @notes, @status, @sources, @source
  )
`);

let inserted = 0;
let skipped = 0;

const insertAll = db.transaction((rows) => {
  for (const s of rows) {
    const result = insert.run({
      id: s.id,
      match_key: s.match_key,
      type: s.type,
      date: s.date,
      time: s.time ?? null,
      title: s.title,
      detected_on: s.detected_on,
      attendees: JSON.stringify(s.attendees ?? []),
      projects: JSON.stringify(s.projects ?? []),
      summary: s.summary ?? null,
      expected_files: JSON.stringify(s.expected_files ?? []),
      notes: s.notes ?? null,
      status: JSON.stringify(s.status ?? {}),
      sources: JSON.stringify(s.sources ?? {}),
      source: 'fixture',
    });
    if (result.changes === 1) {
      inserted++;
    } else {
      skipped++;
      console.log(`  [skip] duplicate id: ${s.id} ("${s.title}" @ ${s.time})`);
    }
  }
});

try {
  insertAll(fixtureSignals);

  db.prepare(`
    INSERT INTO audit_log (action, signal_id, payload, result, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'seed',
    null,
    JSON.stringify({ inserted, skipped, total: fixtureSignals.length }),
    'success',
    `Seeded ${inserted} signals, skipped ${skipped} duplicate ids`
  );

  console.log(`[seed] ✓ Done. Inserted: ${inserted}, Skipped (duplicate ids): ${skipped}`);
  const count = db.prepare('SELECT COUNT(*) AS n FROM signals').get();
  console.log(`[seed] signals table now has ${count.n} rows.`);
} catch (err) {
  console.error(`[seed] ✗ Failed: ${err.message}`);
  process.exit(1);
}