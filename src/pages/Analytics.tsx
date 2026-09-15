import { useMemo } from 'react'
import { api } from '@/lib/api'
import { useAsync, useStored } from '@/lib/hooks'
import { money, pct, rMultiple, ratio, pnlClass, compactMoney } from '@/lib/format'
import type { Bucket, Stats } from '@/lib/types'
import { PageHeader } from '@/components/Layout'
import { Card, CardHeader, Spinner, ErrorNote, Segmented, EmptyState } from '@/components/ui'
import { rangeStart } from './Trades'

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

export default function Analytics() {
  const [range, setRange] = useStored('tj-analytics-range', 'all')
  const query = useMemo(() => ({ from: rangeStart(range) }), [range])
  const { data: stats, loading, error } = useAsync<Stats>(() => api.stats(query), [JSON.stringify(query)])

  if (loading) return <Spinner label="Loading analytics" />
  if (error) return <div className="p-6"><ErrorNote error={error} /></div>
  if (!stats?.summary.trades) {
    return (
      <>
        <PageHeader title="Analytics" />
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
        title="Analytics"
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

        <div className="grid gap-5 xl:grid-cols-2">
          <BreakdownTable title="By trade type" subtitle="Your playbook setups, ranked" rows={stats.bySetup} keyField="setup" />
          <BreakdownTable title="By trade style" subtitle="Day trading vs swing trading" rows={stats.byStyle} keyField="style" />
          <BreakdownTable title="By instrument type" rows={stats.byAssetClass} keyField="assetClass" />
          <BreakdownTable title="Options: buying vs selling premium" rows={stats.byOptionSide} keyField="side" />
          <BreakdownTable title="By ticker" rows={stats.bySymbol} keyField="symbol" />
          <BreakdownTable title="By session" rows={stats.bySession} keyField="session" />
          <BreakdownTable title="By day of week" rows={stats.byDayOfWeek} keyField="day" />
          <BreakdownTable title="By timeframe" rows={stats.byTimeframe} keyField="timeframe" />
          <BreakdownTable title="By direction" rows={stats.byDirection} keyField="direction" />
          <BreakdownTable title="By source" rows={stats.bySource} keyField="source" />
          <BreakdownTable title="By execution grade" subtitle="Does your own grading predict results?" rows={stats.byGrade} keyField="grade" />
          <BreakdownTable title="By emotional state" subtitle="What your state of mind is worth" rows={stats.byEmotion} keyField="emotion" />
          <BreakdownTable title="By mistake tag" subtitle="Cost of each recurring mistake" rows={stats.byMistake} keyField="mistake" />
          <BreakdownTable title="By playbook" rows={stats.byPlaybook} keyField="playbook" />
        </div>
      </div>
    </>
  )
}
