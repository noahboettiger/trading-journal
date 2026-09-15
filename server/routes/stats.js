import { Router } from 'express'
import { listTrades } from '../lib/trades.js'
import {
  summarise, dailyRollup, weeklyRollup, monthlyRollup, equityCurve, groupPerformance, ruleCompliance,
} from '../../shared/calc.js'

export const statsRouter = Router()

/**
 * Per-rule cost analysis: for every rule that appears on at least one trade,
 * compare results when it was followed against results when it was broken.
 * This is the question a yes/no "rules followed" flag can never answer.
 */
function rulePerformance(trades) {
  const byRule = new Map()
  for (const t of trades) {
    for (const check of t.rule_checks ?? []) {
      const key = check.rule_text
      if (!key) continue
      if (!byRule.has(key)) {
        byRule.set(key, { rule_text: key, section: check.section, is_critical: check.is_critical, followed: [], broken: [] })
      }
      byRule.get(key)[check.checked ? 'followed' : 'broken'].push(t)
    }
  }
  return [...byRule.values()]
    .map((r) => {
      const followed = summarise(r.followed)
      const broken = summarise(r.broken)
      return {
        rule_text: r.rule_text,
        section: r.section,
        is_critical: r.is_critical,
        timesApplied: r.followed.length + r.broken.length,
        timesBroken: r.broken.length,
        breakRate: r.followed.length + r.broken.length
          ? (r.broken.length / (r.followed.length + r.broken.length)) * 100
          : null,
        followedPnl: followed.netPnl,
        brokenPnl: broken.netPnl,
        followedWinRate: followed.winRate,
        brokenWinRate: broken.winRate,
        followedAvgR: followed.avgR,
        brokenAvgR: broken.avgR,
      }
    })
    // Most expensive break first. Rules you have never broken sink to the
    // bottom rather than tying at zero with genuinely costly ones.
    .sort((a, b) => {
      if (!a.timesBroken !== !b.timesBroken) return a.timesBroken ? -1 : 1
      return (a.brokenPnl ?? 0) - (b.brokenPnl ?? 0)
    })
}

/** Compare fully-compliant trades against trades with at least one rule broken. */
function complianceSplit(trades) {
  const graded = trades.filter((t) => (t.rule_checks ?? []).length > 0)
  const clean = graded.filter((t) => ruleCompliance(t.rule_checks).clean)
  const dirty = graded.filter((t) => !ruleCompliance(t.rule_checks).clean)
  return {
    graded: graded.length,
    ungraded: trades.length - graded.length,
    compliant: { count: clean.length, ...summarise(clean) },
    nonCompliant: { count: dirty.length, ...summarise(dirty) },
  }
}

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

statsRouter.get('/', (req, res) => {
  const trades = listTrades({ ...req.query, withChildren: true })

  const curve = equityCurve(trades, 0)
  const maxDrawdown = curve.length ? Math.min(...curve.map((p) => p.drawdown)) : 0

  res.json({
    summary: { ...summarise(trades), maxDrawdown },
    daily: dailyRollup(trades),
    weekly: weeklyRollup(trades),
    monthly: monthlyRollup(trades),
    equityCurve: curve,
    compliance: complianceSplit(trades),
    rulePerformance: rulePerformance(trades),
    bySetup: groupPerformance(trades, (t) => t.setup, 'setup'),
    byStyle: groupPerformance(trades, (t) => t.trade_style, 'style'),
    byAssetClass: groupPerformance(trades, (t) => t.asset_class, 'assetClass'),
    byOptionSide: groupPerformance(
      trades.filter((t) => t.asset_class === 'options'),
      (t) => (t.option_side === 'sell' ? 'Selling premium' : 'Buying premium'),
      'side',
    ),
    bySource: groupPerformance(trades, (t) => t.trade_source, 'source'),
    bySession: groupPerformance(trades, (t) => t.session, 'session'),
    bySymbol: groupPerformance(trades, (t) => t.symbol, 'symbol'),
    byDirection: groupPerformance(trades, (t) => t.direction, 'direction'),
    byTimeframe: groupPerformance(trades, (t) => t.timeframe, 'timeframe'),
    byPlaybook: groupPerformance(trades, (t) => t.playbook_name, 'playbook'),
    byGrade: groupPerformance(trades, (t) => t.execution_grade, 'grade'),
    byEmotion: groupPerformance(trades, (t) => t.emotional_state, 'emotion'),
    byDayOfWeek: groupPerformance(
      trades,
      (t) => DOW[new Date(`${String(t.trade_date).slice(0, 10)}T12:00:00`).getDay()],
      'day',
    ),
    byMistake: groupPerformance(
      trades.flatMap((t) => (t.tags ?? []).map((tag) => ({ ...t, _tag: tag.name }))),
      (t) => t._tag,
      'mistake',
    ),
  })
})
