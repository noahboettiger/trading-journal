import './lib/env.js' // must come first: later imports read process.env at load
import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

import { UPLOAD_DIR, DATA_DIR as DATA_DIR_FOR_PID, db } from './lib/db.js'
import { seedIfEmpty } from './lib/seed.js'
import { tradesRouter } from './routes/trades.js'
import { lookupsRouter } from './routes/lookups.js'
import { playbooksRouter } from './routes/playbooks.js'
import { tagsRouter } from './routes/tags.js'
import { statsRouter } from './routes/stats.js'
import { uploadsRouter } from './routes/uploads.js'
import { journalRouter } from './routes/journal.js'
import { exportAll, importAll, snapshot, startAutoBackup, snapshotDir, backupNow } from './lib/backup.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.PORT) || 4317

seedIfEmpty()

const app = express()
app.use(express.json({ limit: '5mb' }))

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, pid: process.pid, version: db.prepare('PRAGMA user_version').get().user_version }),
)
app.use('/api/trades', tradesRouter)
app.use('/api/lookups', lookupsRouter)
app.use('/api/playbooks', playbooksRouter)
app.use('/api/tags', tagsRouter)
app.use('/api/stats', statsRouter)
app.use('/api/uploads', uploadsRouter)
app.use('/api/journal', journalRouter)

app.get('/api/backup', (_req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="journal-backup-${new Date().toISOString().slice(0, 10)}.json"`)
  res.json(exportAll())
})
app.post('/api/backup/snapshot', (_req, res, next) => {
  try {
    const result = snapshot({ label: 'manual' })
    res.json({ ...result, file: path.basename(result.path) })
  } catch (err) {
    next(err)
  }
})
app.post('/api/backup/restore', (req, res, next) => {
  try {
    res.json(importAll(req.body))
  } catch (err) {
    next(err)
  }
})

// Chart screenshots. Served from data/ so they are never bundled into the build.
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '365d', immutable: true }))

// In production the same server hands back the built SPA, so the whole journal
// lives at one address. In dev, Vite serves the UI and proxies /api here.
const DIST = path.join(ROOT, 'dist')
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')))
}

app.use((err, _req, res, _next) => {
  const status = err.status || (err instanceof SyntaxError ? 400 : 500)
  if (status >= 500) console.error('[api]', err)
  res.status(status).json({ error: err.message || 'Internal error' })
})

function lanAddress() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces ?? []) {
      if (i.family === 'IPv4' && !i.internal) return i.address
    }
  }
  return null
}

const PID_FILE = path.join(DATA_DIR_FOR_PID, '.server.pid')

const server = app.listen(PORT, '0.0.0.0', () => {
  fs.writeFileSync(PID_FILE, String(process.pid))
  const lan = lanAddress()
  console.log(`\n  Trading Journal`)
  console.log(`  local     http://localhost:${PORT}`)
  if (lan) console.log(`  network   http://${lan}:${PORT}   (phone on the same wifi)`)
  console.log(`\n  Your data lives on this computer, in these files:`)
  console.log(`  database  ${path.join(DATA_DIR_FOR_PID, 'journal.db')}`)
  console.log(`  charts    ${path.join(DATA_DIR_FOR_PID, 'uploads')}`)
  console.log(`  backups   ${snapshotDir}`)
  if (process.env.JOURNAL_BACKUP_DIR) console.log(`            (JOURNAL_BACKUP_DIR is set)`)
  if (!fs.existsSync(DIST)) console.log(`\n  No build found - API only. Run "npm run dev" for the UI.`)
  console.log('')
  startAutoBackup()
})

// Without this, a second copy of the server dies silently and the stale one
// keeps answering on the port, which looks like code changes not taking effect.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use.`)
    console.error(`  Another copy of the journal is probably running.`)
    console.error(`  Stop it, or start this one on a different port:  PORT=4318 npm start\n`)
  } else {
    console.error('[server]', err)
  }
  process.exit(1)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    // Flush any debounced backup before going away, so closing the terminal
    // right after saving a trade still leaves that trade backed up.
    try {
      backupNow()
    } catch {
      /* best effort on the way out */
    }
    try {
      fs.unlinkSync(PID_FILE)
    } catch {
      /* already gone */
    }
    process.exit(0)
  })
}
