import { Router } from 'express'
import { db } from '../lib/db.js'

export const journalRouter = Router()

journalRouter.get('/', (req, res) => {
  const { from, to, journal_id: journalId } = req.query
  const where = []
  const params = []
  if (from) { where.push('entry_date >= ?'); params.push(from) }
  if (to) { where.push('entry_date <= ?'); params.push(to) }
  if (journalId) { where.push('journal_id = ?'); params.push(Number(journalId)) }
  res.json(
    db.prepare(
      `SELECT * FROM journal_entries ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY entry_date DESC, id DESC`,
    ).all(...params),
  )
})

journalRouter.put('/', (req, res, next) => {
  try {
    const { entry_date, session = null, content = '', mood = null, journal_id: journalId = null } = req.body
    if (!entry_date) return res.status(400).json({ error: 'entry_date is required' })
    const slotSession = session || null
    const slotJournal = journalId ? Number(journalId) : null

    // One entry per journal per day per session. The slot is matched here
    // rather than left to ON CONFLICT, because SQLite counts NULLs in a unique
    // index as distinct: with no session picked, the upsert never saw a
    // conflict and quietly left another copy behind on every save.
    const existing = db
      .prepare('SELECT id FROM journal_entries WHERE entry_date = ? AND session IS ? AND journal_id IS ?')
      .get(entry_date, slotSession, slotJournal)

    let id
    if (existing) {
      db.prepare("UPDATE journal_entries SET content = ?, mood = ?, updated_at = datetime('now') WHERE id = ?")
        .run(content, mood, existing.id)
      id = existing.id
    } else {
      const info = db
        .prepare('INSERT INTO journal_entries (entry_date, session, content, mood, journal_id) VALUES (?, ?, ?, ?, ?)')
        .run(entry_date, slotSession, content, mood, slotJournal)
      id = Number(info.lastInsertRowid)
    }

    res.json(db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(id))
  } catch (err) {
    next(err)
  }
})

journalRouter.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM journal_entries WHERE id = ?').run(Number(req.params.id))
  if (!info.changes) return res.status(404).json({ error: 'Entry not found' })
  res.status(204).end()
})
