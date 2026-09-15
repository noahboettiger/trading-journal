import fs from 'node:fs'
import path from 'node:path'
import { db, DATA_DIR } from './db.js'

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

// ---------------------------------------------------------------------------
// Automatic on-disk snapshots
// ---------------------------------------------------------------------------

/**
 * Where snapshots are written. Separate from DATA_DIR on purpose: a live SQLite
 * database wants a real local disk with working file locking, while backups are
 * write-once files that are perfectly happy on a synced drive. Pointing only
 * this at Google Drive or Dropbox gets off-machine protection without putting
 * the live database on a sync-mounted filesystem.
 */
const SNAPSHOT_DIR = process.env.JOURNAL_BACKUP_DIR || path.join(DATA_DIR, 'backups')
const KEEP_SNAPSHOTS = 30

/**
 * Write a consistent copy of the database to data/backups/.
 *
 * This uses VACUUM INTO rather than copying journal.db, which matters: in WAL
 * mode most recent writes live in journal.db-wal until SQLite checkpoints, so
 * a plain copy of journal.db alone can come back empty or corrupt. VACUUM INTO
 * always produces a complete, self-contained database file.
 */
export function snapshot({ label = 'auto' } = {}) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  const target = path.join(SNAPSHOT_DIR, `journal-${stamp}-${label}.db`)

  if (fs.existsSync(target)) return { path: target, skipped: true }
  // The path is interpolated because VACUUM INTO takes a literal, not a bound
  // parameter. Single quotes are escaped so a quote in the path cannot break out.
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`)

  prune()
  return { path: target, size: fs.statSync(target).size, skipped: false }
}

/** Keep the most recent KEEP_SNAPSHOTS files, delete the rest. */
function prune() {
  const files = fs
    .readdirSync(SNAPSHOT_DIR)
    .filter((f) => f.startsWith('journal-') && f.endsWith('.db'))
    .sort()
  for (const stale of files.slice(0, Math.max(0, files.length - KEEP_SNAPSHOTS))) {
    try {
      fs.unlinkSync(path.join(SNAPSHOT_DIR, stale))
    } catch {
      /* already gone */
    }
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Snapshot on boot (at most once a day) and once a day while running, so an
 * accidental delete or a bad restore is never more than a day of work.
 */
export function startAutoBackup() {
  const takenToday = () => {
    if (!fs.existsSync(SNAPSHOT_DIR)) return false
    const today = new Date().toISOString().slice(0, 10)
    return fs.readdirSync(SNAPSHOT_DIR).some((f) => f.startsWith(`journal-${today}`))
  }

  const run = () => {
    try {
      const hasTrades = db.prepare('SELECT COUNT(*) AS n FROM trades').get().n > 0
      if (!hasTrades || takenToday()) return
      const result = snapshot()
      if (!result.skipped) console.log(`[backup] snapshot saved: ${path.basename(result.path)}`)
    } catch (err) {
      console.error('[backup] snapshot failed:', err.message)
    }
  }

  run()
  const timer = setInterval(run, DAY_MS)
  timer.unref?.()
  return timer
}

export const snapshotDir = SNAPSHOT_DIR
