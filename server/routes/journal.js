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
    db.prepare(
      `INSERT INTO journal_entries (entry_date, session, content, mood, journal_id) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (entry_date, session) DO UPDATE SET
         content = excluded.content, mood = excluded.mood,
         journal_id = excluded.journal_id, updated_at = datetime('now')`,
    ).run(entry_date, session, content, mood, journalId ? Number(journalId) : null)
    res.json(
      db.prepare('SELECT * FROM journal_entries WHERE entry_date = ? AND session IS ?').get(entry_date, session),
    )
  } catch (err) {
    next(err)
  }
})

journalRouter.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM journal_entries WHERE id = ?').run(Number(req.params.id))
  if (!info.changes) return res.status(404).json({ error: 'Entry not found' })
  res.status(204).end()
})
