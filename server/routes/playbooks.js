import { Router } from 'express'
import { db } from '../lib/db.js'
import { num } from '../../shared/calc.js'

export const playbooksRouter = Router()

const withRules = (p) => ({
  ...p,
  is_active: !!p.is_active,
  rules: db
    .prepare('SELECT * FROM rules WHERE playbook_id = ? ORDER BY sort_order, id')
    .all(p.id)
    .map((r) => ({ ...r, is_active: !!r.is_active, is_critical: !!r.is_critical })),
})

playbooksRouter.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM playbooks ORDER BY sort_order, id').all()
  const list = rows.map(withRules)
  res.json(req.query.activeOnly === 'true' ? list.filter((p) => p.is_active) : list)
})

playbooksRouter.post('/', (req, res, next) => {
  try {
    const { name, asset_class = 'futures', description = null, sort_order = 0 } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })
    const info = db
      .prepare('INSERT INTO playbooks (name, asset_class, description, sort_order) VALUES (?, ?, ?, ?)')
      .run(name, asset_class, description, num(sort_order) ?? 0)
    res.status(201).json(withRules(db.prepare('SELECT * FROM playbooks WHERE id = ?').get(Number(info.lastInsertRowid))))
  } catch (err) {
    next(err)
  }
})

playbooksRouter.put('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const fields = ['name', 'asset_class', 'description', 'sort_order', 'is_active'].filter((f) => f in req.body)
    if (!fields.length) return res.status(400).json({ error: 'nothing to update' })
    const values = fields.map((f) => (f === 'is_active' ? (req.body[f] ? 1 : 0) : req.body[f]))
    const info = db.prepare(`UPDATE playbooks SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`).run(...values, id)
    if (!info.changes) return res.status(404).json({ error: 'Playbook not found' })
    res.json(withRules(db.prepare('SELECT * FROM playbooks WHERE id = ?').get(id)))
  } catch (err) {
    next(err)
  }
})

playbooksRouter.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM playbooks WHERE id = ?').run(Number(req.params.id))
  if (!info.changes) return res.status(404).json({ error: 'Playbook not found' })
  res.status(204).end()
})

/**
 * Replace a playbook's whole rule list in one shot. Rules that still carry an
 * id are updated in place so historical trade_rule_checks keep pointing at
 * them; the rest are inserted. Rules dropped from the payload are deleted,
 * which is safe because past trades store their own snapshot of the text.
 */
playbooksRouter.put('/:id/rules', (req, res, next) => {
  const playbookId = Number(req.params.id)
  const incoming = Array.isArray(req.body.rules) ? req.body.rules : null
  if (!incoming) return res.status(400).json({ error: 'rules array is required' })

  db.exec('BEGIN')
  try {
    const keptIds = incoming.map((r) => num(r.id)).filter((id) => id !== null)
    const existing = db.prepare('SELECT id FROM rules WHERE playbook_id = ?').all(playbookId).map((r) => r.id)
    const toDelete = existing.filter((id) => !keptIds.includes(id))
    if (toDelete.length) {
      db.prepare(`DELETE FROM rules WHERE id IN (${toDelete.map(() => '?').join(', ')})`).run(...toDelete)
    }

    const update = db.prepare(
      'UPDATE rules SET section = ?, text = ?, detail = ?, is_critical = ?, is_active = ?, sort_order = ? WHERE id = ? AND playbook_id = ?',
    )
    const insert = db.prepare(
      'INSERT INTO rules (playbook_id, section, text, detail, is_critical, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    incoming.forEach((r, i) => {
      const args = [
        r.section || 'Model Compliance',
        r.text || '',
        r.detail ?? null,
        r.is_critical ? 1 : 0,
        r.is_active === false ? 0 : 1,
        r.sort_order ?? i,
      ]
      const id = num(r.id)
      if (id !== null) update.run(...args, id, playbookId)
      else insert.run(playbookId, ...args)
    })

    db.exec('COMMIT')
    res.json(withRules(db.prepare('SELECT * FROM playbooks WHERE id = ?').get(playbookId)))
  } catch (err) {
    db.exec('ROLLBACK')
    next(err)
  }
})
