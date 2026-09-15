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
    const entry = num(t.entry_premium)
    const exit = num(t.exit_premium)
    if (entry === null || exit === null || contracts === null) return null
    return round2((exit - entry) * optionSideSign(t) * contracts * OPTION_MULTIPLIER)
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
export function summarise(trades) {
  const closed = trades.filter((t) => t.status !== 'planned' && num(t.net_pnl) !== null)
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
    const net = num(t.net_pnl)
    if (net === null || t.status === 'planned') continue
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
    .filter((t) => num(t.net_pnl) !== null && t.status !== 'planned')
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
  if (!t.expiration) return null
  const end = t.exit_date ?? (t.status === 'open' ? new Date().toISOString().slice(0, 10) : t.trade_date)
  return daysBetween(end, t.expiration)
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
    const net = num(t.net_pnl)
    if (net === null || t.status === 'planned') continue
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
    const net = num(t.net_pnl)
    if (net === null || t.status === 'planned') continue
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
  const strike = num(t.strike)
  const contracts = num(t.contracts)
  if (strike === null || contracts === null) return null
  return round2(strike * OPTION_MULTIPLIER * contracts)
}

/** Credit taken in at open, before any buy-back. */
export function creditReceived(t) {
  if (t.option_side !== 'sell') return null
  const premium = num(t.entry_premium)
  const contracts = num(t.contracts)
  if (premium === null || contracts === null) return null
  return round2(premium * OPTION_MULTIPLIER * contracts)
}

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
  const entry = num(t.entry_premium)
  const exit = num(t.exit_premium)
  if (entry === null || entry === 0) return null
  // An open position has captured nothing yet; treat a missing exit as zero.
  return ((entry - (exit ?? 0)) / Math.abs(entry)) * 100
}
