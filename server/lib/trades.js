import { db } from './db.js'
import { backupSoon } from './backup.js'
import {
  deriveNetPnl, deriveGrossPnl, deriveRiskAmount, resultR, deriveOutcome, plannedRR,
  daysHeld, dteAtEntry, dteAtExit, returnOnRisk, num,
  collateralRequired, creditReceived, returnOnCollateral, annualisedReturn, percentOfMaxProfit,
  buybackCost, positionLegs, currentLeg, rollCount, optionCashFlows,
  positionExits, contractsOpened, contractsClosed, contractsRemaining, realisedSoFar,
} from '../../shared/calc.js'

/** Columns a client is allowed to write. Anything else in a payload is ignored. */
export const TRADE_COLUMNS = [
  'journal_id', 'playbook_id', 'asset_class', 'trade_style', 'symbol', 'direction', 'status', 'outcome',
  'trade_date', 'exit_date', 'entry_time', 'exit_time', 'session', 'timeframe', 'setup', 'trade_source',
  'contracts', 'entry_price', 'exit_price', 'stop_price', 'target_price', 'point_value',
  'option_type', 'option_side', 'strike', 'expiration', 'entry_premium', 'exit_premium',
  'close_method', 'collateral',
  'underlying_entry', 'underlying_stop', 'underlying_target', 'dte_at_entry',
  'delta', 'theta', 'vega', 'iv_at_entry',
  'risk_amount', 'planned_rr', 'gross_pnl', 'commissions', 'net_pnl', 'result_r_override',
  'execution_grade', 'trade_rating', 'emotional_state', 'thesis', 'notes', 'lesson_learned', 'reflections',
]

const NUMERIC_COLUMNS = new Set([
  'journal_id', 'playbook_id', 'contracts', 'entry_price', 'exit_price', 'stop_price',
  'target_price', 'point_value', 'strike', 'entry_premium', 'exit_premium',
  'underlying_entry', 'underlying_stop', 'underlying_target', 'dte_at_entry',
  'delta', 'theta', 'vega', 'iv_at_entry', 'collateral', 'risk_amount', 'planned_rr', 'gross_pnl',
  'commissions', 'net_pnl', 'result_r_override',
])

/** Coerce a raw request body into a column->value map, dropping unknown keys. */
function normalise(body) {
  const row = {}
  for (const col of TRADE_COLUMNS) {
    if (!(col in body)) continue
    const raw = body[col]
    if (NUMERIC_COLUMNS.has(col)) {
      row[col] = num(raw)
    } else if (raw === '' || raw === undefined) {
      row[col] = null
    } else {
      row[col] = raw
    }
  }
  return row
}

const DERIVED_COLUMNS = [
  'gross_pnl', 'net_pnl', 'planned_rr', 'risk_amount', 'collateral', 'outcome',
  'commissions', 'manual_fields',
]

/**
 * Money fields that stay exactly as typed once the trader has entered one.
 *
 * Entry and exit prices are optional reference values, so a figure derived from
 * them must never overwrite a real P&L or risk number. Sending one of these as
 * blank clears the mark and hands the field back to the derivation.
 */
const MANUAL_TRACKED = ['gross_pnl', 'net_pnl', 'risk_amount']

const parseManual = (value) =>
  new Set(String(value ?? '').split(',').map((f) => f.trim()).filter(Boolean))

/**
 * Fill in money fields the client did not send explicitly.
 *
 * `provided` is the set of columns actually present in the request body. A
 * derived value overwrites only when the client stayed silent AND the
 * derivation produced a real number. That way editing an exit price does
 * recompute P&L, while editing only the notes never clobbers a P&L the user
 * typed by hand for a trade that has no price fields filled in.
 */
function applyDerivations(row, provided = new Set()) {
  if (row.commissions === null || row.commissions === undefined) row.commissions = 0

  // Anything the client sent explicitly becomes manual; anything it sent blank
  // goes back to being derived.
  const manual = parseManual(row.manual_fields)
  for (const field of MANUAL_TRACKED) {
    if (!provided.has(field)) continue
    if (row[field] === null || row[field] === undefined) manual.delete(field)
    else manual.add(field)
  }

  // The manual set already encodes "sent explicitly with a real value", so it
  // is the only condition. Sending a field blank removes it from the set above
  // and the derivation takes the field back, which is the point of clearing it.
  const shouldDerive = (field) => !manual.has(field)

  if (shouldDerive('gross_pnl')) {
    const v = deriveGrossPnl(row)
    if (v !== null) row.gross_pnl = v
  }
  if (shouldDerive('net_pnl')) {
    const v = deriveNetPnl(row)
    if (v !== null) row.net_pnl = v
  }
  if (!provided.has('planned_rr')) {
    const v = plannedRR(row)
    if (v !== null) row.planned_rr = v
  }
  if (!provided.has('collateral')) {
    const v = collateralRequired({ ...row, collateral: null })
    if (v !== null) row.collateral = v
  }
  if (shouldDerive('risk_amount')) {
    const v = deriveRiskAmount(row)
    if (v !== null) row.risk_amount = v
  }
  if (!provided.has('outcome')) {
    const v = deriveOutcome({ ...row, outcome: null })
    if (v !== null) row.outcome = v
  }

  row.manual_fields = [...manual].join(',')
  return row
}

const providedColumns = (body) => new Set(TRADE_COLUMNS.filter((c) => c in body))

/** Attach computed fields plus rule checks, tags and images. */
export function enrich(trade, { withChildren = true } = {}) {
  if (!trade) return null

  // Loaded first: credit, collateral and P&L all sum across the roll chain.
  const rolls = db
    .prepare('SELECT * FROM trade_rolls WHERE trade_id = ? ORDER BY sort_order, id')
    .all(trade.id)
  const exits = db
    .prepare('SELECT * FROM trade_exits WHERE trade_id = ? ORDER BY sort_order, id')
    .all(trade.id)
  trade = { ...trade, rolls, exits }

  const out = {
    ...trade,
    result_r: resultR(trade),
    computed_rr: plannedRR(trade),
    days_held: daysHeld(trade),
    dte_entry: dteAtEntry(trade),
    dte_exit: dteAtExit(trade),
    return_on_risk: returnOnRisk(trade),
    rolls,
    exits,
    position_exits: positionExits(trade),
    contracts_opened: contractsOpened(trade),
    contracts_closed: contractsClosed(trade),
    contracts_remaining: contractsRemaining(trade),
    realised_so_far: realisedSoFar(trade),
    cash_flows: optionCashFlows(trade),
    legs: positionLegs(trade),
    current_leg: currentLeg(trade),
    roll_count: rollCount(trade),
    buyback_cost: buybackCost(trade),
    collateral_required: collateralRequired(trade),
    credit_received: creditReceived(trade),
    return_on_collateral: returnOnCollateral(trade),
    annualised_return: annualisedReturn(trade),
    pct_of_max_profit: percentOfMaxProfit(trade),
  }
  if (withChildren) {
    out.rule_checks = db
      .prepare('SELECT * FROM trade_rule_checks WHERE trade_id = ? ORDER BY sort_order, id')
      .all(trade.id)
      .map((c) => ({ ...c, checked: !!c.checked, is_critical: !!c.is_critical }))
    out.tags = db
      .prepare('SELECT t.* FROM tags t JOIN trade_tags tt ON tt.tag_id = t.id WHERE tt.trade_id = ? ORDER BY t.name')
      .all(trade.id)
    out.images = db
      .prepare('SELECT * FROM trade_images WHERE trade_id = ? ORDER BY sort_order, id')
      .all(trade.id)
  }
  out.journal_name = trade.journal_id
    ? db.prepare('SELECT name FROM journals WHERE id = ?').get(trade.journal_id)?.name ?? null
    : null
  out.playbook_name = trade.playbook_id
    ? db.prepare('SELECT name FROM playbooks WHERE id = ?').get(trade.playbook_id)?.name ?? null
    : null
  return out
}

export function nextTradeNumber() {
  const row = db.prepare('SELECT COALESCE(MAX(trade_no), 0) AS n FROM trades').get()
  return row.n + 1
}

function replaceChildren(tradeId, body) {
  if (Array.isArray(body.rule_checks)) {
    db.prepare('DELETE FROM trade_rule_checks WHERE trade_id = ?').run(tradeId)
    const ins = db.prepare(
      `INSERT INTO trade_rule_checks (trade_id, rule_id, section, rule_text, is_critical, checked, note, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    body.rule_checks.forEach((c, i) =>
      ins.run(
        tradeId,
        num(c.rule_id),
        c.section ?? '',
        c.rule_text ?? '',
        c.is_critical ? 1 : 0,
        c.checked ? 1 : 0,
        c.note ?? null,
        c.sort_order ?? i,
      ),
    )
  }

  if (Array.isArray(body.tag_ids)) {
    db.prepare('DELETE FROM trade_tags WHERE trade_id = ?').run(tradeId)
    const ins = db.prepare('INSERT OR IGNORE INTO trade_tags (trade_id, tag_id) VALUES (?, ?)')
    body.tag_ids.forEach((id) => {
      const n = num(id)
      if (n !== null) ins.run(tradeId, n)
    })
  }

  if (Array.isArray(body.rolls)) {
    db.prepare('DELETE FROM trade_rolls WHERE trade_id = ?').run(tradeId)
    const ins = db.prepare(
      `INSERT INTO trade_rolls
         (trade_id, rolled_on, net_credit, close_cost, new_strike, new_expiration, new_contracts, new_credit, commissions, note, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    body.rolls.forEach((r, i) =>
      ins.run(
        tradeId,
        r.rolled_on || null,
        num(r.net_credit),
        num(r.close_cost),
        num(r.new_strike),
        r.new_expiration || null,
        num(r.new_contracts),
        num(r.new_credit),
        num(r.commissions) ?? 0,
        r.note ?? null,
        r.sort_order ?? i,
      ),
    )
  }

  if (Array.isArray(body.exits)) {
    db.prepare('DELETE FROM trade_exits WHERE trade_id = ?').run(tradeId)
    const ins = db.prepare(
      'INSERT INTO trade_exits (trade_id, exited_on, contracts, price, note, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    )
    body.exits.forEach((e, i) =>
      ins.run(tradeId, e.exited_on || null, num(e.contracts), num(e.price), e.note ?? null, e.sort_order ?? i),
    )
  }

  if (Array.isArray(body.images)) {
    db.prepare('DELETE FROM trade_images WHERE trade_id = ?').run(tradeId)
    const ins = db.prepare('INSERT INTO trade_images (trade_id, path, caption, sort_order) VALUES (?, ?, ?, ?)')
    body.images.forEach((img, i) => {
      if (img?.path) ins.run(tradeId, img.path, img.caption ?? null, img.sort_order ?? i)
    })
  }
}

export function createTrade(body) {
  const row = applyDerivations(
    { ...normalise(body), rolls: body.rolls ?? [], exits: body.exits ?? [] },
    providedColumns(body),
  )
  delete row.rolls
  delete row.exits
  if (!row.symbol) throw Object.assign(new Error('symbol is required'), { status: 400 })
  if (!row.trade_date) throw Object.assign(new Error('trade_date is required'), { status: 400 })

  const tradeNo = num(body.trade_no) ?? nextTradeNumber()
  const cols = ['trade_no', ...Object.keys(row)]
  const values = [tradeNo, ...Object.values(row)]

  db.exec('BEGIN')
  try {
    const info = db
      .prepare(`INSERT INTO trades (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
      .run(...values)
    const id = Number(info.lastInsertRowid)
    replaceChildren(id, body)
    db.exec('COMMIT')
    backupSoon()
    return getTrade(id)
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export function updateTrade(id, body) {
  const existing = db.prepare('SELECT * FROM trades WHERE id = ?').get(id)
  if (!existing) return null

  // Derive against the merged record so editing one price recomputes the rest.
  const patch = normalise(body)
  const existingRolls = db
    .prepare('SELECT * FROM trade_rolls WHERE trade_id = ? ORDER BY sort_order, id')
    .all(id)
  const existingExits = db
    .prepare('SELECT * FROM trade_exits WHERE trade_id = ? ORDER BY sort_order, id')
    .all(id)
  const merged = applyDerivations(
    { ...existing, ...patch, rolls: body.rolls ?? existingRolls, exits: body.exits ?? existingExits },
    providedColumns(body),
  )
  for (const col of DERIVED_COLUMNS) {
    if (merged[col] !== existing[col]) patch[col] = merged[col]
  }
  delete patch.rolls
  delete patch.exits

  db.exec('BEGIN')
  try {
    if (body.trade_no !== undefined) patch.trade_no = num(body.trade_no)
    const keys = Object.keys(patch)
    if (keys.length) {
      db.prepare(
        `UPDATE trades SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
      ).run(...keys.map((k) => patch[k]), id)
    }
    replaceChildren(id, body)
    db.exec('COMMIT')
    backupSoon()
    return getTrade(id)
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export function getTrade(id) {
  return enrich(db.prepare('SELECT * FROM trades WHERE id = ?').get(id))
}

export function deleteTrade(id) {
  const deleted = db.prepare('DELETE FROM trades WHERE id = ?').run(id).changes > 0
  if (deleted) backupSoon()
  return deleted
}

/** Filtered trade list. Filters are all optional and combine with AND. */
export function listTrades(q = {}) {
  const where = []
  const params = []
  const eq = (col, val) => {
    if (val !== undefined && val !== null && val !== '' && val !== 'all') {
      where.push(`${col} = ?`)
      params.push(val)
    }
  }
  eq('journal_id', num(q.journal_id))
  eq('playbook_id', num(q.playbook_id))
  eq('asset_class', q.asset_class)
  eq('trade_style', q.trade_style)
  eq('option_side', q.option_side)
  eq('option_type', q.option_type)
  eq('close_method', q.close_method)
  eq('outcome', q.outcome)
  eq('direction', q.direction)
  eq('session', q.session)
  eq('setup', q.setup)
  eq('trade_rating', q.trade_rating)
  eq('execution_grade', q.execution_grade)
  eq('trade_source', q.trade_source)
  eq('status', q.status)
  if (q.symbol) {
    where.push('UPPER(symbol) = UPPER(?)')
    params.push(q.symbol)
  }
  if (q.from) {
    where.push('trade_date >= ?')
    params.push(q.from)
  }
  if (q.to) {
    where.push('trade_date <= ?')
    params.push(q.to)
  }
  if (q.search) {
    where.push(
      '(notes LIKE ? OR thesis LIKE ? OR lesson_learned LIKE ? OR reflections LIKE ? OR setup LIKE ? OR symbol LIKE ?)',
    )
    const like = `%${q.search}%`
    params.push(like, like, like, like, like, like)
  }

  const sql = `SELECT * FROM trades ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY trade_date DESC, trade_no DESC`
  const rows = db.prepare(sql).all(...params)
  return rows.map((r) => enrich(r, { withChildren: q.withChildren !== false }))
}
