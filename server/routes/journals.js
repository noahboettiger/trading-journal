import { Router } from 'express'
import { db } from '../lib/db.js'
import { num } from '../../shared/calc.js'

export const journalsRouter = Router()

const COLUMNS = [
  'name', 'kind', 'default_asset_class', 'default_trade_style',
  'default_playbook_id', 'sort_order', 'is_active',
]

function normalise(body) {
  const row = {}
  for (const col of COLUMNS) {
    if (!(col in body)) continue
    if (col === 'is_active') row[col] = body[col] ? 1 : 0
    else if (col === 'default_playbook_id' || col === 'sort_order') row[col] = num(body[col])
    else row[col] = body[col] === '' ? null : body[col]
  }
  return row
}

journalsRouter.get('/', (_req, res) => {
  const journals = db.prepare('SELECT * FROM journals ORDER BY sort_order, id').all()
  const counts = db
    .prepare('SELECT journal_id, COUNT(*) AS n, COALESCE(SUM(net_pnl), 0) AS pnl FROM trades GROUP BY journal_id')
    .all()
  const byId = new Map(counts.map((c) => [c.journal_id, c]))
  res.json(
    journals.map((j) => ({
      ...j,
      is_active: !!j.is_active,
      trade_count: byId.get(j.id)?.n ?? 0,
      net_pnl: byId.get(j.id)?.pnl ?? 0,
    })),
  )
})

journalsRouter.post('/', (req, res, next) => {
  try {
    const row = normalise(req.body)
    if (!row.name) return res.status(400).json({ error: 'name is required' })
    if (row.sort_order === null || row.sort_order === undefined) {
      row.sort_order = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM journals').get().n
    }
    const keys = Object.keys(row)
    const info = db
      .prepare(`INSERT INTO journals (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`)
      .run(...keys.map((k) => row[k]))
    res.status(201).json(db.prepare('SELECT * FROM journals WHERE id = ?').get(Number(info.lastInsertRowid)))
  } catch (err) {
    next(err)
  }
})

journalsRouter.put('/reorder', (req, res, next) => {
  const { ids } = req.body
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids is required' })
  db.exec('BEGIN')
  try {
    const stmt = db.prepare('UPDATE journals SET sort_order = ? WHERE id = ?')
    ids.forEach((id, i) => {
      const n = num(id)
      if (n !== null) stmt.run(i, n)
    })
    db.exec('COMMIT')
    res.json(db.prepare('SELECT * FROM journals ORDER BY sort_order, id').all())
  } catch (err) {
    db.exec('ROLLBACK')
    next(err)
  }
})

journalsRouter.put('/:id', (req, res, next) => {
  try {
    const row = normalise(req.body)
    const keys = Object.keys(row)
    if (!keys.length) return res.status(400).json({ error: 'nothing to update' })
    const info = db
      .prepare(`UPDATE journals SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .run(...keys.map((k) => row[k]), Number(req.params.id))
    if (!info.changes) return res.status(404).json({ error: 'Journal not found' })
    res.json(db.prepare('SELECT * FROM journals WHERE id = ?').get(Number(req.params.id)))
  } catch (err) {
    next(err)
  }
})

/**
 * Deleting a journal that still holds trades would orphan them, so it is
 * refused with a count rather than silently detaching the record.
 */
journalsRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  const trades = db.prepare('SELECT COUNT(*) AS n FROM trades WHERE journal_id = ?').get(id).n
  if (trades > 0) {
    return res.status(409).json({
      error: `This journal still holds ${trades} trade${trades === 1 ? '' : 's'}. Move or delete them first.`,
    })
  }
  if (db.prepare('SELECT COUNT(*) AS n FROM journals').get().n <= 1) {
    return res.status(409).json({ error: 'There has to be at least one journal.' })
  }
  const info = db.prepare('DELETE FROM journals WHERE id = ?').run(id)
  if (!info.changes) return res.status(404).json({ error: 'Journal not found' })
  res.status(204).end()
})
