/**
 * Pure trade math shared by the API and the UI. No I/O, no framework imports.
 */

const OPTION_MULTIPLIER = 100

export const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Money rounded to cents, so float drift never reaches the database. */
const round2 = (v) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 100) / 100)

const dirSign = (direction) => (direction === 'short' ? -1 : 1)

/**
 * P&L sign for an options position. Buying premium profits when the premium
 * rises; selling premium profits when it falls. `direction` stays the market
 * bias (a short put is bullish), so it must not drive this sign.
 */
const optionSideSign = (t) => (t.option_side === 'sell' ? -1 : 1)

/** Gross P&L implied by the price fields, or null when inputs are incomplete. */
export function deriveGrossPnl(t) {
  const contracts = num(t.contracts)
  const sign = dirSign(t.direction)

  if (t.asset_class === 'options') {
    // Only closing the final contract realises the position. A roll closes a
    // leg while the position carries on, so an open rolled put must not report
    // the credit it has banked so far as though it were a finished result.
    if (!isPositionClosed(t)) return null
    const flows = optionCashFlows(t)
    if (!flows.length || flows.some((f) => f.amount === null)) return null
    return round2(flows.reduce((a, f) => a + f.amount, 0))
  }

  const entry = num(t.entry_price)
  const exit = num(t.exit_price)
  const pv = num(t.point_value)
  if (entry === null || exit === null || contracts === null || pv === null) return null
  return round2((exit - entry) * sign * contracts * pv)
}

export function deriveNetPnl(t) {
  const gross = num(t.gross_pnl) ?? deriveGrossPnl(t)
  if (gross === null) return null
  return round2(gross - (num(t.commissions) ?? 0))
}

/**
 * Dollar risk implied by the position, or null when inputs are incomplete.
 *
 * Futures: stop distance x contracts x point value - exact.
 * Long options: full premium paid, which is the true max loss. A stop on the
 * underlying caps it lower in practice, but converting an underlying level
 * into a premium loss needs an options pricing model, so this stays the
 * conservative figure and `risk_amount` can be overridden by hand.
 */
export function deriveRiskAmount(t) {
  const contracts = num(t.contracts)
  if (contracts === null) return null

  if (t.asset_class === 'options') {
    if (t.option_side === 'sell') {
      // A cash-secured put ties up the strike in cash, and that collateral is
      // the honest risk figure. Other short positions (covered calls, spreads,
      // naked) depend on how they are secured, so those stay manual.
      return collateralRequired(t)
    }
    const entry = num(t.entry_premium)
    if (entry === null) return null
    return round2(Math.abs(entry) * contracts * OPTION_MULTIPLIER)
  }

  const entry = num(t.entry_price)
  const stop = num(t.stop_price)
  const pv = num(t.point_value)
  if (entry === null || stop === null || pv === null) return null
  return round2(Math.abs(entry - stop) * contracts * pv)
}

/** Planned reward:risk from the entry/stop/target triplet. */
export function plannedRR(t) {
  const isOptions = t.asset_class === 'options'
  const entry = num(isOptions ? t.underlying_entry : t.entry_price)
  const stop = num(isOptions ? t.underlying_stop : t.stop_price)
  const target = num(isOptions ? t.underlying_target : t.target_price)
  if (entry === null || stop === null || target === null) return null
  const risk = Math.abs(entry - stop)
  if (risk === 0) return null
  return Math.abs(target - entry) / risk
}

/** Realised R. Explicit override wins, otherwise net P&L over dollar risk. */
export function resultR(t) {
  const override = num(t.result_r_override)
  if (override !== null) return override
  const risk = num(t.risk_amount)
  const net = num(t.net_pnl)
  if (risk === null || net === null || risk === 0) return null
  return net / risk
}

/** Outcome inferred from net P&L when not set explicitly. */
export function deriveOutcome(t) {
  if (t.outcome) return t.outcome
  const net = num(t.net_pnl)
  if (net === null) return null
  if (net > 0) return 'win'
  if (net < 0) return 'loss'
  return 'breakeven'
}

export function ruleCompliance(checks = []) {
  const total = checks.length
  const checked = checks.filter((c) => c.checked).length
  const criticalMissed = checks.filter((c) => c.is_critical && !c.checked).length
  return {
    total,
    checked,
    missed: total - checked,
    criticalMissed,
    pct: total ? (checked / total) * 100 : null,
    clean: total > 0 && checked === total,
  }
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0)
const mean = (xs) => (xs.length ? sum(xs) / xs.length : null)

/**
 * Aggregate performance over a set of enriched trades (each already carrying
 * net_pnl, result_r and outcome).
 */
export const isRealised = (t) => t.status === 'closed' && num(t.net_pnl) !== null

export function summarise(trades) {
  const closed = trades.filter(isRealised)
  const pnls = closed.map((t) => num(t.net_pnl))
  const wins = closed.filter((t) => t.outcome === 'win')
  const losses = closed.filter((t) => t.outcome === 'loss')
  const breakevens = closed.filter((t) => t.outcome === 'breakeven')
  const decided = wins.length + losses.length

  const winPnls = wins.map((t) => num(t.net_pnl))
  const lossPnls = losses.map((t) => num(t.net_pnl))
  const grossWin = sum(winPnls)
  const grossLoss = Math.abs(sum(lossPnls))
  const rs = closed.map((t) => num(t.result_r)).filter((r) => r !== null)

  // Longest run of consecutive wins / losses, plus the run still in progress.
  let streak = 0
  let bestWin = 0
  let worstLoss = 0
  let run = 0
  let runKind = null
  for (const t of closed) {
    if (t.outcome === 'win' || t.outcome === 'loss') {
      if (t.outcome === runKind) run += 1
      else {
        run = 1
        runKind = t.outcome
      }
      if (runKind === 'win') bestWin = Math.max(bestWin, run)
      else worstLoss = Math.max(worstLoss, run)
    }
  }
  streak = runKind === 'win' ? run : runKind === 'loss' ? -run : 0

  return {
    trades: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    winRate: decided ? (wins.length / decided) * 100 : null,
    netPnl: sum(pnls),
    grossWin,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : null,
    avgWin: mean(winPnls),
    avgLoss: mean(lossPnls),
    avgTrade: mean(pnls),
    expectancy: mean(pnls),
    avgR: mean(rs),
    totalR: rs.length ? sum(rs) : null,
    bestTrade: pnls.length ? Math.max(...pnls) : null,
    worstTrade: pnls.length ? Math.min(...pnls) : null,
    currentStreak: streak,
    longestWinStreak: bestWin,
    longestLossStreak: worstLoss,
  }
}

/** Per-day rollup used by the calendar. Keyed by YYYY-MM-DD. */
export function dailyRollup(trades) {
  const byDay = new Map()
  for (const t of trades) {
    if (!isRealised(t)) continue
    const net = num(t.net_pnl)
    const key = String(t.trade_date).slice(0, 10)
    if (!byDay.has(key)) byDay.set(key, { date: key, pnl: 0, trades: 0, wins: 0, losses: 0, r: 0 })
    const d = byDay.get(key)
    d.pnl += net
    d.trades += 1
    if (t.outcome === 'win') d.wins += 1
    if (t.outcome === 'loss') d.losses += 1
    d.r += num(t.result_r) ?? 0
  }
  return [...byDay.values()]
    .map((d) => ({ ...d, winRate: d.wins + d.losses ? (d.wins / (d.wins + d.losses)) * 100 : null }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Running equity from a starting balance, ordered by date then trade number. */
export function equityCurve(trades, startingBalance = 0) {
  const ordered = [...trades]
    .filter(isRealised)
    .sort((a, b) =>
      a.trade_date === b.trade_date ? a.trade_no - b.trade_no : a.trade_date.localeCompare(b.trade_date),
    )
  let equity = startingBalance
  let peak = startingBalance
  return ordered.map((t) => {
    equity += num(t.net_pnl)
    peak = Math.max(peak, equity)
    return {
      tradeNo: t.trade_no,
      date: t.trade_date,
      pnl: num(t.net_pnl),
      equity,
      drawdown: equity - peak,
    }
  })
}

/** Group trades by an arbitrary key and summarise each bucket. */
export function groupPerformance(trades, keyFn, label = 'key') {
  const groups = new Map()
  for (const t of trades) {
    const k = keyFn(t) || 'Unspecified'
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(t)
  }
  return [...groups.entries()]
    .map(([k, ts]) => ({ [label]: k, ...summarise(ts) }))
    .sort((a, b) => b.netPnl - a.netPnl)
}


const DAY_MS = 86400000
const asDay = (v) => {
  if (!v) return null
  const d = new Date(`${String(v).slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}
const daysBetween = (a, b) => {
  const from = asDay(a)
  const to = asDay(b)
  if (!from || !to) return null
  return Math.round((to - from) / DAY_MS)
}

/** Calendar days the position was held. Open trades count up to today. */
export function daysHeld(t) {
  const end = t.exit_date ?? (t.status === 'open' ? new Date().toISOString().slice(0, 10) : t.trade_date)
  return daysBetween(t.trade_date, end)
}

/** Days to expiration at entry, preferring the stored value when present. */
export function dteAtEntry(t) {
  const stored = num(t.dte_at_entry)
  if (stored !== null) return stored
  return daysBetween(t.trade_date, t.expiration)
}

/** Days to expiration left when the position was closed (or today if open). */
export function dteAtExit(t) {
  const expiration = currentLeg(t).expiration ?? t.expiration
  if (!expiration) return null
  const end = t.exit_date ?? (t.status === 'open' ? new Date().toISOString().slice(0, 10) : t.trade_date)
  return daysBetween(end, expiration)
}

/** Return on the premium at risk, the number that matters for options. */
export function returnOnRisk(t) {
  const risk = num(t.risk_amount)
  const net = num(t.net_pnl)
  if (risk === null || net === null || risk === 0) return null
  return (net / Math.abs(risk)) * 100
}

/** ISO week key (YYYY-Www) plus the Monday that starts the week. */
export function weekKey(iso) {
  const d = asDay(iso)
  if (!d) return null
  const target = new Date(d)
  const day = (target.getDay() + 6) % 7 // Monday = 0
  target.setDate(target.getDate() - day)
  const monday = target
  const thursday = new Date(monday)
  thursday.setDate(monday.getDate() + 3)
  const firstThursday = new Date(thursday.getFullYear(), 0, 4)
  const week =
    1 + Math.round((thursday - firstThursday) / (7 * DAY_MS) - ((firstThursday.getDay() + 6) % 7) / 7)
  const pad = (n) => String(n).padStart(2, '0')
  return {
    key: `${thursday.getFullYear()}-W${pad(week)}`,
    weekStart: `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`,
  }
}

/** Per-week rollup, mirroring dailyRollup. */
export function weeklyRollup(trades) {
  const byWeek = new Map()
  for (const t of trades) {
    if (!isRealised(t)) continue
    const net = num(t.net_pnl)
    const wk = weekKey(t.trade_date)
    if (!wk) continue
    if (!byWeek.has(wk.key)) {
      byWeek.set(wk.key, { week: wk.key, weekStart: wk.weekStart, pnl: 0, trades: 0, wins: 0, losses: 0, r: 0 })
    }
    const w = byWeek.get(wk.key)
    w.pnl += net
    w.trades += 1
    if (t.outcome === 'win') w.wins += 1
    if (t.outcome === 'loss') w.losses += 1
    w.r += num(t.result_r) ?? 0
  }
  return [...byWeek.values()]
    .map((w) => ({ ...w, winRate: w.wins + w.losses ? (w.wins / (w.wins + w.losses)) * 100 : null }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

/** Per-month rollup, keyed YYYY-MM. */
export function monthlyRollup(trades) {
  const byMonth = new Map()
  for (const t of trades) {
    if (!isRealised(t)) continue
    const net = num(t.net_pnl)
    const key = String(t.trade_date).slice(0, 7)
    if (!byMonth.has(key)) byMonth.set(key, { month: key, pnl: 0, trades: 0, wins: 0, losses: 0, r: 0 })
    const m = byMonth.get(key)
    m.pnl += net
    m.trades += 1
    if (t.outcome === 'win') m.wins += 1
    if (t.outcome === 'loss') m.losses += 1
    m.r += num(t.result_r) ?? 0
  }
  return [...byMonth.values()]
    .map((m) => ({ ...m, winRate: m.wins + m.losses ? (m.wins / (m.wins + m.losses)) * 100 : null }))
    .sort((a, b) => a.month.localeCompare(b.month))
}


/**
 * Cash tied up by a short put: the strike, times 100, times contracts. Returns
 * null for anything that is not a cash-secured put, since collateral for other
 * structures depends on how the position is secured.
 */
export function collateralRequired(t) {
  const explicit = num(t.collateral)
  if (explicit !== null) return explicit
  if (t.asset_class !== 'options' || t.option_side !== 'sell' || t.option_type !== 'put') return null
  // A roll can move the strike or the size, so the capital tied up is the
  // contract in hand, not the one this position started with.
  const leg = currentLeg(t)
  if (leg.strike === null || leg.contracts === null) return null
  return round2(leg.strike * OPTION_MULTIPLIER * leg.contracts)
}

/**
 * Every contract this position has held, oldest first.
 *
 * Leg one is the trade's own contract fields; each roll closes the leg in hand
 * and opens the next. A position that was never rolled is simply one leg, so
 * the same arithmetic covers both cases.
 */
export function positionLegs(t) {
  const legs = [
    {
      leg: 1,
      opened_on: t.trade_date ?? null,
      strike: num(t.strike),
      expiration: t.expiration ?? null,
      contracts: num(t.contracts),
      credit: num(t.entry_premium),
      close_cost: null,
      closed_on: null,
      close_method: null,
      commissions: 0,
    },
  ]

  const rolls = [...(t.rolls ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  rolls.forEach((roll, i) => {
    const prev = legs[legs.length - 1]
    prev.close_cost = num(roll.close_cost)
    prev.closed_on = roll.rolled_on ?? null
    prev.close_method = 'rolled'
    legs.push({
      leg: i + 2,
      opened_on: roll.rolled_on ?? null,
      strike: num(roll.new_strike) ?? prev.strike,
      expiration: roll.new_expiration ?? prev.expiration,
      contracts: num(roll.new_contracts) ?? prev.contracts,
      credit: num(roll.new_credit),
      close_cost: null,
      closed_on: null,
      close_method: null,
      commissions: num(roll.commissions) ?? 0,
    })
  })

  // The final leg is closed by the trade's own exit, if it has one.
  const last = legs[legs.length - 1]
  last.close_cost = num(t.exit_premium)
  last.closed_on = t.exit_date ?? null
  last.close_method = t.close_method ?? null
  return legs
}

/** The contract currently held, which is the last leg of the chain. */
export const currentLeg = (t) => {
  const legs = positionLegs(t)
  return legs[legs.length - 1]
}

/**
 * Every cash movement this options position made, in order.
 *
 * Working in cash flows rather than per-leg pairs is what lets a combo roll
 * work: a diagonal fills as a single order with one net price, so the broker
 * never reports a separate buy-back and sale. A roll contributes whichever it
 * has, a net price or the two halves, and the arithmetic is the same either way.
 *
 * Selling premium takes cash in on open and pays it out on close; buying does
 * the reverse, which the sign handles.
 */
export function optionCashFlows(t) {
  if (t.asset_class !== 'options') return []
  const sign = t.option_side === 'sell' ? 1 : -1
  const flows = []

  let contracts = num(t.contracts) ?? 0
  const entry = num(t.entry_premium)
  if (entry !== null) {
    flows.push({
      kind: 'open',
      date: t.trade_date ?? null,
      strike: num(t.strike),
      expiration: t.expiration ?? null,
      contracts,
      premium: entry,
      amount: round2(sign * entry * OPTION_MULTIPLIER * contracts),
    })
  }

  const sortedRolls = [...(t.rolls ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  for (const [i, roll] of sortedRolls.entries()) {
    const rollContracts = num(roll.new_contracts) ?? contracts
    const netPrice = num(roll.net_credit)
    const closeCost = num(roll.close_cost)
    const newCredit = num(roll.new_credit)

    if (netPrice !== null) {
      // A combo order fills at one price, so that is all there is to record.
      flows.push({
        kind: 'roll',
        date: roll.rolled_on ?? null,
        strike: num(roll.new_strike),
        expiration: roll.new_expiration ?? null,
        contracts: rollContracts,
        premium: netPrice,
        isNetPrice: true,
        amount: round2(sign * netPrice * OPTION_MULTIPLIER * rollContracts),
      })
    } else if (closeCost !== null || newCredit !== null) {
      // Closed and reopened as two orders, so both prices are known and both
      // belong in the ledger. Collapsing them to a net would understate the
      // credit taken in and overstate the share of maximum profit kept.
      flows.push({
        kind: 'roll-close',
        date: roll.rolled_on ?? null,
        strike: i === 0 ? num(t.strike) : null,
        expiration: null,
        contracts,
        premium: closeCost,
        amount: closeCost === null ? null : round2(-sign * closeCost * OPTION_MULTIPLIER * contracts),
      })
      flows.push({
        kind: 'roll',
        date: roll.rolled_on ?? null,
        strike: num(roll.new_strike),
        expiration: roll.new_expiration ?? null,
        contracts: rollContracts,
        premium: newCredit,
        amount: newCredit === null ? null : round2(sign * newCredit * OPTION_MULTIPLIER * rollContracts),
      })
    }
    contracts = rollContracts
  }

  const exit = num(t.exit_premium)
  if (exit !== null) {
    flows.push({
      kind: 'close',
      date: t.exit_date ?? null,
      contracts,
      premium: exit,
      amount: round2(-sign * exit * OPTION_MULTIPLIER * contracts),
    })
  }

  return flows
}

/** True once the final contract has been closed out. */
export const isPositionClosed = (t) => num(t.exit_premium) !== null

/** Cash taken in: every inflow, including the net credit on a roll. */
export function creditReceived(t) {
  if (t.option_side !== 'sell') return null
  const flows = optionCashFlows(t)
  if (!flows.length) return null
  return round2(flows.reduce((a, f) => a + Math.max(f.amount ?? 0, 0), 0))
}

/** Cash paid out: buy-backs, and the debit side of any roll that cost money. */
export function buybackCost(t) {
  if (t.option_side !== 'sell') return null
  const flows = optionCashFlows(t)
  return round2(flows.reduce((a, f) => a + Math.min(f.amount ?? 0, 0), 0) * -1)
}

/** How many times this position has been rolled. */
export const rollCount = (t) => (t.rolls ?? []).length

/** Percent return on the collateral posted. */
export function returnOnCollateral(t) {
  const collateral = collateralRequired(t)
  const net = num(t.net_pnl)
  if (collateral === null || net === null || collateral === 0) return null
  return (net / collateral) * 100
}

/**
 * Simple annualised return: the realised percentage scaled to a full year by
 * days held. A 2% gain over 30 days annualises to roughly 24%.
 *
 * This is the standard way premium sellers compare trades of different
 * durations. It is not compounded, and it assumes the capital could be
 * redeployed at the same rate, which is a big assumption on a short sample.
 */
export function annualisedReturn(t, basePercent = null) {
  const base = basePercent ?? returnOnCollateral(t)
  const held = daysHeld(t)
  if (base === null || held === null) return null
  // Same-day closes would divide by zero, so floor the holding period at a day.
  return base * (365 / Math.max(held, 1))
}

/**
 * Share of the maximum possible profit captured. For a short option the most
 * you can make is the credit, so closing a $6.40 credit at $1.15 banks 82%.
 * This is the number to check against a 50-60% buy-back target.
 */
export function percentOfMaxProfit(t) {
  if (t.option_side !== 'sell') return null
  const credit = creditReceived(t)
  if (credit === null || credit === 0) return null
  // The most this campaign can keep is every dollar it ever took in.
  return ((credit - (buybackCost(t) ?? 0)) / Math.abs(credit)) * 100
}

/**
 * Fields that hold several values in one text column, stored comma separated.
 * A single legacy value parses as a one-item list, so nothing needs migrating.
 */
export const parseMulti = (value) =>
  String(value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

export const joinMulti = (values) => (Array.isArray(values) ? values : parseMulti(values)).join(', ')


/** What is still live: count, capital tied up and credit already taken in. */
export function openPositions(trades) {
  const open = trades.filter((t) => t.status === 'open')
  return {
    count: open.length,
    collateral: open.reduce((a, t) => a + (collateralRequired(t) ?? num(t.risk_amount) ?? 0), 0),
    credit: open.reduce((a, t) => a + (creditReceived(t) ?? 0), 0),
  }
}
