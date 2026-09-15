import { Router } from 'express'
import { db } from '../lib/db.js'

export const tagsRouter = Router()

tagsRouter.get('/', (req, res) => {
  const rows = req.query.kind
    ? db.prepare('SELECT * FROM tags WHERE kind = ? ORDER BY name').all(req.query.kind)
    : db.prepare('SELECT * FROM tags ORDER BY kind, name').all()
  res.json(rows)
})

tagsRouter.post('/', (req, res, next) => {
  try {
    const { name, kind = 'mistake' } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })
    db.prepare('INSERT OR IGNORE INTO tags (name, kind) VALUES (?, ?)').run(name, kind)
    res.status(201).json(db.prepare('SELECT * FROM tags WHERE name = ? AND kind = ?').get(name, kind))
  } catch (err) {
    next(err)
  }
})

tagsRouter.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM tags WHERE id = ?').run(Number(req.params.id))
  if (!info.changes) return res.status(404).json({ error: 'Tag not found' })
  res.status(204).end()
})
