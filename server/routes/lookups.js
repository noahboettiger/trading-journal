import { Router } from 'express'
import { db } from '../lib/db.js'
import { num } from '../../shared/calc.js'

export const lookupsRouter = Router()

/** Every editable dropdown list, grouped by kind. */
lookupsRouter.get('/', (req, res) => {
  const rows = req.query.kind
    ? db.prepare('SELECT * FROM lookups WHERE kind = ? ORDER BY sort_order, value').all(req.query.kind)
    : db.prepare('SELECT * FROM lookups ORDER BY kind, sort_order, value').all()
  const list = rows.map((r) => ({ ...r, is_active: !!r.is_active }))

  if (req.query.grouped === 'true') {
    const grouped = {}
    for (const row of list) (grouped[row.kind] ??= []).push(row)
    return res.json(grouped)
  }
  res.json(list)
})

lookupsRouter.post('/', (req, res, next) => {
  try {
    const { kind, value, asset_class = null, sort_order = 0 } = req.body
    if (!kind || !value) return res.status(400).json({ error: 'kind and value are required' })
    db.prepare('INSERT OR IGNORE INTO lookups (kind, value, asset_class, sort_order) VALUES (?, ?, ?, ?)')
      .run(kind, value, asset_class || null, num(sort_order) ?? 0)
    res.status(201).json(db.prepare('SELECT * FROM lookups WHERE kind = ? AND value = ?').get(kind, value))
  } catch (err) {
    next(err)
  }
})

lookupsRouter.put('/:id', (req, res, next) => {
  try {
    const fields = ['value', 'asset_class', 'sort_order', 'is_active'].filter((f) => f in req.body)
    if (!fields.length) return res.status(400).json({ error: 'nothing to update' })
    const values = fields.map((f) =>
      f === 'is_active' ? (req.body[f] ? 1 : 0) : f === 'sort_order' ? num(req.body[f]) ?? 0 : req.body[f] || null,
    )
    const info = db
      .prepare(`UPDATE lookups SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`)
      .run(...values, Number(req.params.id))
    if (!info.changes) return res.status(404).json({ error: 'Not found' })
    res.json(db.prepare('SELECT * FROM lookups WHERE id = ?').get(Number(req.params.id)))
  } catch (err) {
    next(err)
  }
})

lookupsRouter.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM lookups WHERE id = ?').run(Number(req.params.id))
  if (!info.changes) return res.status(404).json({ error: 'Not found' })
  res.status(204).end()
})
