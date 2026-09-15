import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell, ReferenceLine,
} from 'recharts'
import { Plus, TrendingUp, Percent, Scale, Target, ShieldCheck, Flame } from 'lucide-react'

import { api } from '@/lib/api'
import { useAsync, useStored } from '@/lib/hooks'
import { money, compactMoney, pct, ratio, rMultiple, formatDay, pnlClass } from '@/lib/format'
import type { Stats } from '@/lib/types'
import { PageHeader } from '@/components/Layout'
import { Card, CardHeader, Stat, PnlStat, Spinner, ErrorNote, EmptyState, Segmented, Badge } from '@/components/ui'
import { PnlCalendar } from '@/components/PnlCalendar'
import { rangeStart } from './Trades'

const RANGES = [
  { value: 'all', label: 'All' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
  { value: 'mtd', label: 'MTD' },
  { value: 'ytd', label: 'YTD' },
]

function ChartTooltip({ active, payload, label, valueKey = 'equity', prefix = '' }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-surface-1 px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold">{prefix}{label}</div>
      <div className={`tnum ${pnlClass(payload[0].value)}`}>{money(payload[0].payload[valueKey], { sign: true })}</div>
      {payload[0].payload.trades !== undefined && (
        <div className="text-ink-faint tnum">{payload[0].payload.trades} trades</div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [range, setRange] = useStored('tj-dash-range', 'all')
  const [month, setMonth] = useState(() => new Date())

  const query = useMemo(() => ({ from: rangeStart(range) }), [range])
  const { data: stats, loading, error } = useAsync<Stats>(() => api.stats(query), [JSON.stringify(query)])

  const s = stats?.summary
  const compliance = stats?.compliance

  const curve = useMemo(
    () =>
      (stats?.equityCurve ?? []).map((p, i) => ({
        ...p,
        index: i + 1,
        // The curve is ordered by date, so label it by date: trade numbers are
        // assigned at entry time and would read out of order here.
        label: formatDay(p.date, { month: 'short', day: 'numeric' }),
      })),
    [stats],
  )

  const monthlyBars = useMemo(
    () =>
      (stats?.monthly ?? []).map((m) => ({
        ...m,
        label: `${new Date(`${m.month}-15T12:00:00`).toLocaleDateString('en-US', { month: 'short' })} '${m.month.slice(2, 4)}`,
      })),
    [stats],
  )

  if (loading) return <Spinner label="Crunching your numbers" />
  if (error) return <div className="p-6"><ErrorNote error={error} /></div>

  if (!s?.trades) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="p-4 lg:p-7">
          <Card>
            <EmptyState
              icon={<TrendingUp size={28} />}
              title="No trades logged yet"
              body="Log a trade and this dashboard fills in: equity curve, monthly P&L calendar, rule compliance and what your broken rules actually cost."
              action={<Link className="btn-primary" to="/trades/new"><Plus size={15} /> Log your first trade</Link>}
            />
          </Card>
        </div>
      </>
    )
  }

  const complianceEdge =
    compliance && compliance.compliant.count && compliance.nonCompliant.count
      ? (compliance.compliant.avgR ?? 0) - (compliance.nonCompliant.avgR ?? 0)
      : null

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${s.trades} trades · ${s.wins}W / ${s.losses}L`}
        actions={
          <>
            <Segmented value={range} onChange={setRange} options={RANGES} />
            <Link className="btn-primary" to="/trades/new"><Plus size={15} /> Log trade</Link>
          </>
        }
      />

      <div className="space-y-5 px-4 py-5 lg:px-7">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
          <PnlStat label="Net P&L" value={s.netPnl} sub={`${s.trades} trades`} icon={<TrendingUp size={14} />} />
          <Stat label="Win rate" value={pct(s.winRate, 0)} sub={`${s.wins}W / ${s.losses}L`} icon={<Percent size={14} />} />
          <Stat label="Profit factor" value={ratio(s.profitFactor)} sub={`${compactMoney(s.grossWin)} / ${compactMoney(-s.grossLoss)}`} icon={<Scale size={14} />}
            tone={s.profitFactor !== null && s.profitFactor >= 1 ? 'good' : 'bad'} />
          <Stat label="Avg R" value={s.avgR === null ? '--' : rMultiple(s.avgR)} sub={`${s.totalR === null ? '--' : rMultiple(s.totalR)} total`}
            icon={<Target size={14} />} tone={(s.avgR ?? 0) >= 0 ? 'good' : 'bad'} />
          <PnlStat label="Avg trade" value={s.avgTrade} sub={`Best ${compactMoney(s.bestTrade)}`} />
          <PnlStat label="Max drawdown" value={s.maxDrawdown} sub={`Worst ${compactMoney(s.worstTrade)}`} />
          <Stat label="Streak" value={s.currentStreak === 0 ? '--' : `${Math.abs(s.currentStreak)}${s.currentStreak > 0 ? 'W' : 'L'}`}
            sub={`Best ${s.longestWinStreak}W · worst ${s.longestLossStreak}L`} icon={<Flame size={14} />}
            tone={s.currentStreak > 0 ? 'good' : s.currentStreak < 0 ? 'bad' : 'neutral'} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Equity curve */}
          <Card>
            <CardHeader title="Equity curve" subtitle="Cumulative net P&L by trade" />
            <div className="h-[280px] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={curve} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgb(var(--ink-faint))' }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgb(var(--ink-faint))' }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => compactMoney(v)} width={58} />
                  <ReferenceLine y={0} stroke="rgb(var(--line))" />
                  <Tooltip content={<ChartTooltip valueKey="equity" />} />
                  <Area type="monotone" dataKey="equity" stroke="rgb(var(--accent))" strokeWidth={2} fill="url(#equityFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Monthly P&L bars */}
          <Card>
            <CardHeader title="Monthly P&L" subtitle="Net result per calendar month" />
            <div className="h-[280px] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgb(var(--ink-faint))' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgb(var(--ink-faint))' }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => compactMoney(v)} width={58} />
                  <ReferenceLine y={0} stroke="rgb(var(--line))" />
                  <Tooltip cursor={{ fill: 'rgb(var(--surface-2))' }} content={<ChartTooltip valueKey="pnl" />} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {monthlyBars.map((m) => (
                      <Cell key={m.month} fill={m.pnl >= 0 ? 'rgb(var(--win))' : 'rgb(var(--loss))'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Calendar */}
        <Card>
          <CardHeader title="Trading calendar" subtitle="Daily P&L with weekly totals" />
          <PnlCalendar month={month} onMonthChange={setMonth} days={stats?.daily ?? []} />
        </Card>

        {/* Rule compliance */}
        {compliance && compliance.graded > 0 && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <Card className="self-start">
              <CardHeader title="Rule compliance" icon={<ShieldCheck size={15} />} subtitle="Clean trades vs trades with a rule broken" />
              <div className="space-y-3 p-5">
                {[
                  { label: 'Every rule followed', d: compliance.compliant, tone: 'win' as const },
                  { label: 'At least one rule broken', d: compliance.nonCompliant, tone: 'loss' as const },
                ].map(({ label, d, tone }) => (
                  <div key={label} className={`rounded-lg border p-4 ${tone === 'win' ? 'border-win/25 bg-win/5' : 'border-loss/25 bg-loss/5'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{label}</span>
                      <Badge tone={tone}>{d.count} trades</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        ['Net P&L', money(d.netPnl, { sign: true }), pnlClass(d.netPnl)],
                        ['Win rate', pct(d.winRate, 0), ''],
                        ['Avg R', d.avgR === null ? '--' : rMultiple(d.avgR), pnlClass(d.avgR)],
                      ].map(([k, v, cls]) => (
                        <div key={k}>
                          <div className="label">{k}</div>
                          <div className={`text-sm font-semibold tnum ${cls}`}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {complianceEdge !== null && (
                  <p className="text-xs leading-relaxed text-ink-faint">
                    Following every rule is worth{' '}
                    <span className={`font-semibold ${complianceEdge >= 0 ? 'text-win' : 'text-loss'}`}>
                      {rMultiple(complianceEdge)}
                    </span>{' '}
                    per trade compared with breaking at least one.
                  </p>
                )}
                {compliance.ungraded > 0 && (
                  <p className="text-xs text-ink-faint">{compliance.ungraded} trade(s) have no checklist attached.</p>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="What broken rules cost" subtitle="Net P&L on trades where each rule was left unchecked" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left">
                      {['Rule', 'Broken', 'P&L when broken', 'P&L when followed'].map((h) => (
                        <th key={h} className="label px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(stats?.rulePerformance ?? []).filter((r) => r.timesBroken > 0).slice(0, 8).map((r) => (
                      <tr key={r.rule_text}>
                        <td className="max-w-[260px] px-4 py-2.5">
                          <div className="truncate font-medium" title={r.rule_text}>{r.rule_text}</div>
                          <div className="text-[11px] text-ink-faint">{r.section}</div>
                        </td>
                        <td className="px-4 py-2.5 tnum text-ink-muted">
                          {r.timesBroken}/{r.timesApplied}
                          <span className="ml-1 text-[11px] text-ink-faint">({pct(r.breakRate, 0)})</span>
                        </td>
                        <td className={`px-4 py-2.5 font-semibold tnum ${pnlClass(r.brokenPnl)}`}>{money(r.brokenPnl, { sign: true })}</td>
                        <td className={`px-4 py-2.5 tnum ${pnlClass(r.followedPnl)}`}>{money(r.followedPnl, { sign: true })}</td>
                      </tr>
                    ))}
                    {!(stats?.rulePerformance ?? []).some((r) => r.timesBroken > 0) && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-faint">
                        No rules broken in this range. Clean book.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
