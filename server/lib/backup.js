import { db } from './db.js'

const TABLES = [
  'lookups', 'playbooks', 'rules', 'trades',
  'trade_rule_checks', 'trade_tags', 'trade_images', 'tags', 'journal_entries',
]

/** Full JSON snapshot of the database. Chart image files are not included. */
export function exportAll() {
  const data = {}
  for (const t of TABLES) data[t] = db.prepare(`SELECT * FROM ${t}`).all()
  return {
    format: 'trading-journal-backup',
    version: db.prepare('PRAGMA user_version').get().user_version,
    exported_at: new Date().toISOString(),
    data,
  }
}

/** Destructive restore: wipes every table, then reinserts from the snapshot. */
export function importAll(payload) {
  if (payload?.format !== 'trading-journal-backup') {
    throw Object.assign(new Error('Not a trading-journal backup file'), { status: 400 })
  }
  const data = payload.data ?? {}

  db.exec('BEGIN')
  try {
    db.exec('PRAGMA defer_foreign_keys = ON')
    for (const t of [...TABLES].reverse()) db.exec(`DELETE FROM ${t}`)

    const counts = {}
    for (const t of TABLES) {
      const rows = data[t] ?? []
      counts[t] = rows.length
      if (!rows.length) continue
      const cols = Object.keys(rows[0])
      const stmt = db.prepare(
        `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      )
      for (const row of rows) stmt.run(...cols.map((c) => row[c] ?? null))
    }
    db.exec('COMMIT')
    return { restored: counts }
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
