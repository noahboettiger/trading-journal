import { Router } from 'express'
import { db } from '../lib/db.js'

export const journalRouter = Router()

journalRouter.get('/', (req, res) => {
  const { from, to } = req.query
  const where = []
  const params = []
  if (from) { where.push('entry_date >= ?'); params.push(from) }
  if (to) { where.push('entry_date <= ?'); params.push(to) }
  res.json(
    db.prepare(
      `SELECT * FROM journal_entries ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY entry_date DESC, id DESC`,
    ).all(...params),
  )
})

journalRouter.put('/', (req, res, next) => {
  try {
    const { entry_date, session = null, content = '', mood = null } = req.body
    if (!entry_date) return res.status(400).json({ error: 'entry_date is required' })
    db.prepare(
      `INSERT INTO journal_entries (entry_date, session, content, mood) VALUES (?, ?, ?, ?)
       ON CONFLICT (entry_date, session) DO UPDATE SET content = excluded.content, mood = excluded.mood, updated_at = datetime('now')`,
    ).run(entry_date, session, content, mood)
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
