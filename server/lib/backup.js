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
    // The rolling backup is deliberately excluded: it is always the newest
    // file and must never be pruned away.
    .filter((f) => f.startsWith('journal-') && f.endsWith('.db') && f !== 'journal-latest.db')
    .sort()
  for (const stale of files.slice(0, Math.max(0, files.length - KEEP_SNAPSHOTS))) {
    try {
      fs.unlinkSync(path.join(SNAPSHOT_DIR, stale))
    } catch {
      /* already gone */
    }
  }
}

/**
 * A single rolling copy, overwritten after every change. The daily snapshots
 * give you history; this gives you "nothing I typed is more than a few seconds
 * from being safe". Kept separate so pruning never touches it.
 */
const LATEST_PATH = () => path.join(SNAPSHOT_DIR, 'journal-latest.db')

let pending = null
let lastWrite = 0
const DEBOUNCE_MS = 3000

function writeLatest() {
  try {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
    const target = LATEST_PATH()
    const temp = `${target}.tmp`
    // Write to a temp file and rename, so a crash mid-write can never leave a
    // half-written backup where a good one used to be. Rename is atomic.
    fs.rmSync(temp, { force: true })
    db.exec(`VACUUM INTO '${temp.replace(/'/g, "''")}'`)
    fs.renameSync(temp, target)
    lastWrite = Date.now()
  } catch (err) {
    console.error('[backup] rolling backup failed:', err.message)
  }
}

/**
 * Called after every trade create, update and delete. Debounced, so saving a
 * trade backs it up within a few seconds while a burst of edits does not
 * rewrite the file over and over.
 */
export function backupSoon() {
  if (pending) return
  const wait = Math.max(0, DEBOUNCE_MS - (Date.now() - lastWrite))
  pending = setTimeout(() => {
    pending = null
    writeLatest()
  }, wait)
  pending.unref?.()
}

/** Force the rolling backup to disk immediately, cancelling any pending run. */
export function backupNow() {
  if (pending) {
    clearTimeout(pending)
    pending = null
  }
  writeLatest()
  return LATEST_PATH()
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
