import { useMemo } from 'react'
import { api } from '@/lib/api'
import { useAsync, useStored } from '@/lib/hooks'
import { money, pct, rMultiple, ratio, pnlClass, compactMoney } from '@/lib/format'
import type { Trade } from '@/lib/types'
import { CLOSE_METHOD_LABELS, GRADES } from '@/lib/instruments'
import type { Bucket, Stats } from '@/lib/types'
import { PageHeader } from '@/components/Layout'
import { Card, CardHeader, Spinner, ErrorNote, Segmented, EmptyState } from '@/components/ui'
import { rangeStart } from './Trades'
import { useJournal } from '@/lib/journals'

const RANGES = [
  { value: 'all', label: 'All' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
  { value: 'mtd', label: 'MTD' },
  { value: 'ytd', label: 'YTD' },
]

/** One grouped-performance table. Bars scale to the largest absolute P&L. */
function BreakdownTable({ title, subtitle, rows, keyField }: {
  title: string
  subtitle?: string
  rows: Bucket[]
  keyField: string
}) {
  const max = useMemo(() => Math.max(1, ...rows.map((r) => Math.abs(r.netPnl))), [rows])
  const real = rows.filter((r) => r.trades > 0)

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      {real.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                {['', 'Trades', 'Win rate', 'Avg R', 'Net P&L'].map((h, i) => (
                  <th key={i} className="label px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {real.map((r) => (
                <tr key={String(r[keyField])} className="hover:bg-surface-2/60">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{String(r[keyField])}</div>
                    <div className="mt-1 h-1 w-full max-w-[160px] overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={`h-full rounded-full ${r.netPnl >= 0 ? 'bg-win' : 'bg-loss'}`}
                        style={{ width: `${Math.max(3, (Math.abs(r.netPnl) / max) * 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 tnum text-ink-muted">
                    {r.trades}
                    <span className="ml-1 text-[11px] text-ink-faint">({r.wins}W/{r.losses}L)</span>
                  </td>
                  <td className="px-4 py-2.5 tnum text-ink-muted">{pct(r.winRate, 0)}</td>
                  <td className={`px-4 py-2.5 tnum font-medium ${pnlClass(r.avgR)}`}>{r.avgR === null ? '--' : rMultiple(r.avgR)}</td>
                  <td className={`px-4 py-2.5 tnum font-semibold ${pnlClass(r.netPnl)}`}>{money(r.netPnl, { sign: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Nothing here yet" body="Log trades with this field filled in and the breakdown appears." />
      )}
    </Card>
  )
}

/**
 * Premium selling is judged differently from directional trades: what matters is
 * the return on the collateral you tied up and how fast you got it, not R.
 */
function PremiumSelling({ trades }: { trades: Trade[] }) {
  const closed = trades.filter((t) => t.net_pnl !== null)
  const totalPnl = closed.reduce((a, t) => a + (t.net_pnl ?? 0), 0)
  const totalCredit = closed.reduce((a, t) => a + (t.credit_received ?? 0), 0)
  const withCollateral = closed.filter((t) => t.collateral_required)
  const avgReturn = withCollateral.length
    ? withCollateral.reduce((a, t) => a + (t.return_on_collateral ?? 0), 0) / withCollateral.length
    : null
  // Capital-weighted, so a big position counts for more than a small one.
  const weightedAnnualised = (() => {
    const capital = withCollateral.reduce((a, t) => a + (t.collateral_required ?? 0), 0)
    if (!capital) return null
    return withCollateral.reduce((a, t) => a + (t.annualised_return ?? 0) * (t.collateral_required ?? 0), 0) / capital
  })()
  const avgHeld = closed.length
    ? closed.reduce((a, t) => a + (t.days_held ?? 0), 0) / closed.length
    : null
  const avgCaptured = closed.filter((t) => t.pct_of_max_profit !== null).length
    ? closed.reduce((a, t) => a + (t.pct_of_max_profit ?? 0), 0) /
      closed.filter((t) => t.pct_of_max_profit !== null).length
    : null

  const byClose = new Map<string, { n: number; pnl: number }>()
  for (const t of closed) {
    const k = t.close_method ? (CLOSE_METHOD_LABELS[t.close_method] ?? t.close_method) : 'Not recorded'
    const cur = byClose.get(k) ?? { n: 0, pnl: 0 }
    byClose.set(k, { n: cur.n + 1, pnl: cur.pnl + (t.net_pnl ?? 0) })
  }

  return (
    <Card>
      <CardHeader
        title="Premium selling"
        subtitle={`${closed.length} closed position${closed.length === 1 ? '' : 's'} - judged on return to collateral, not R`}
      />
      <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-6">
        {[
          ['Net P&L', money(totalPnl, { sign: true }), pnlClass(totalPnl)],
          ['Credit taken in', money(totalCredit, { cents: false }), ''],
          ['Avg return on collateral', pct(avgReturn, 2), pnlClass(avgReturn)],
          ['Annualised (capital weighted)', pct(weightedAnnualised, 1), pnlClass(weightedAnnualised)],
          ['Avg days held', avgHeld === null ? '--' : `${avgHeld.toFixed(0)}d`, ''],
          ['Avg max profit captured', pct(avgCaptured, 0), avgCaptured !== null && avgCaptured >= 50 ? 'text-win' : ''],
        ].map(([label, value, cls]) => (
          <div key={label as string} className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
            <div className="label leading-tight">{label}</div>
            <div className={`mt-1 text-base font-semibold tnum ${cls}`}>{value}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-line px-4 py-3">
        <div className="label mb-2">How positions closed</div>
        <div className="flex flex-wrap gap-2">
          {[...byClose.entries()].map(([k, v]) => (
            <span key={k} className="chip">
              {k}
              <span className="tnum text-ink-faint">{v.n}</span>
              <span className={`tnum font-semibold ${pnlClass(v.pnl)}`}>{money(v.pnl, { sign: true })}</span>
            </span>
          ))}
        </div>
      </div>
    </Card>
  )
}

/** Order grade buckets best to worst rather than by P&L, so the trend reads. */
function sortByGrade(rows: Bucket[], key: string): Bucket[] {
  const rank = new Map(GRADES.map((g, i) => [g, i]))
  return [...rows].sort(
    (a, b) => (rank.get(String(a[key])) ?? 99) - (rank.get(String(b[key])) ?? 99),
  )
}

export default function Analytics() {
  const [range, setRange] = useStored('tj-analytics-range', 'all')
  const { journalId, journal } = useJournal()
  const query = useMemo(
    () => ({ from: rangeStart(range), journal_id: journalId ?? undefined }),
    [range, journalId],
  )
  const { data: stats, loading, error } = useAsync<Stats>(
    () => (journalId === null ? Promise.resolve(null as unknown as Stats) : api.stats(query)),
    [JSON.stringify(query)],
  )
  const { data: sells } = useAsync<Trade[]>(
    () =>
      journalId === null
        ? Promise.resolve([])
        : api.trades.list({ ...query, asset_class: 'options', option_side: 'sell' }),
    [JSON.stringify(query)],
  )

  if (loading) return <Spinner label="Loading analytics" />
  if (error) return <div className="p-6"><ErrorNote error={error} /></div>
  if (!stats?.summary.trades) {
    return (
      <>
        <PageHeader title={journal ? `${journal.name} analytics` : 'Analytics'} />
        <div className="p-4 lg:p-7">
          <Card><EmptyState title="No trades to analyse" body="Once you have logged a few trades, this page breaks them down every way that matters." /></Card>
        </div>
      </>
    )
  }

  const s = stats.summary

  return (
    <>
      <PageHeader
        title={journal ? `${journal.name} analytics` : 'Analytics'}
        subtitle="Where the money actually comes from"
        actions={<Segmented value={range} onChange={setRange} options={RANGES} />}
      />

      <div className="space-y-5 px-4 py-5 lg:px-7">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {[
            ['Expectancy', money(s.expectancy, { sign: true }), pnlClass(s.expectancy)],
            ['Avg win', money(s.avgWin), 'text-win'],
            ['Avg loss', money(s.avgLoss), 'text-loss'],
            ['Payoff ratio', s.avgLoss ? ratio(Math.abs((s.avgWin ?? 0) / s.avgLoss)) : '--', ''],
            ['Gross win', compactMoney(s.grossWin), 'text-win'],
            ['Gross loss', compactMoney(-s.grossLoss), 'text-loss'],
          ].map(([label, value, cls]) => (
            <div key={label as string} className="card px-4 py-3">
              <div className="label">{label}</div>
              <div className={`mt-1 text-lg font-semibold tnum ${cls}`}>{value}</div>
            </div>
          ))}
        </div>

        {!!sells?.length && <PremiumSelling trades={sells} />}

        <div className="grid gap-5 xl:grid-cols-2">
          <BreakdownTable title="By entry model" subtitle="Your models, ranked" rows={stats.bySetup} keyField="setup" />
          <BreakdownTable
            title="By setup rating"
            subtitle="Does your own read on setup quality predict the result?"
            rows={sortByGrade(stats.byRating, 'rating')}
            keyField="rating"
          />
          <BreakdownTable title="By trade style" subtitle="Day trading vs swing trading" rows={stats.byStyle} keyField="style" />
          <BreakdownTable
            title="By account type"
            subtitle="Whether the bigger eval cap is actually clearing evals"
            rows={stats.byAccountType}
            keyField="accountType"
          />
          <BreakdownTable title="By instrument type" rows={stats.byAssetClass} keyField="assetClass" />
          <BreakdownTable title="Options: buying vs selling premium" rows={stats.byOptionSide} keyField="side" />
          <BreakdownTable title="By ticker" rows={stats.bySymbol} keyField="symbol" />
          <BreakdownTable title="By session" rows={stats.bySession} keyField="session" />
          <BreakdownTable title="By day of week" rows={stats.byDayOfWeek} keyField="day" />
          <BreakdownTable title="By timeframe" rows={stats.byTimeframe} keyField="timeframe" />
          <BreakdownTable title="By direction" rows={stats.byDirection} keyField="direction" />
          <BreakdownTable title="By source" rows={stats.bySource} keyField="source" />
          <BreakdownTable
            title="By execution grade"
            subtitle="What sloppy execution actually costs you"
            rows={sortByGrade(stats.byGrade, 'grade')}
            keyField="grade"
          />
          <BreakdownTable
            title="By emotional state"
            subtitle="Trades count under every state they carry, so these overlap"
            rows={stats.byEmotion}
            keyField="emotion"
          />
          <BreakdownTable title="By mistake tag" subtitle="Cost of each recurring mistake" rows={stats.byMistake} keyField="mistake" />
          <BreakdownTable title="By playbook" rows={stats.byPlaybook} keyField="playbook" />
        </div>
      </div>
    </>
  )
}
