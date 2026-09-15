import { useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { money, pct, rMultiple, formatDay, pnlClass } from '@/lib/format'
import type { Stats } from '@/lib/types'
import { PageHeader } from '@/components/Layout'
import { Card, CardHeader, Spinner, ErrorNote, Segmented } from '@/components/ui'
import { PnlCalendar } from '@/components/PnlCalendar'

type Grain = 'day' | 'week' | 'month'

export default function CalendarPage() {
  const [month, setMonth] = useState(() => new Date())
  const [grain, setGrain] = useState<Grain>('day')
  const { data: stats, loading, error } = useAsync<Stats>(() => api.stats(), [])

  const rows = useMemo(() => {
    if (!stats) return []
    if (grain === 'day') {
      return [...stats.daily].reverse().map((d) => ({
        key: d.date,
        label: formatDay(d.date, { weekday: 'short', month: 'short', day: 'numeric' }),
        ...d,
      }))
    }
    if (grain === 'week') {
      return [...stats.weekly].reverse().map((w) => ({
        key: w.week,
        label: `${w.week} · week of ${formatDay(w.weekStart, { month: 'short', day: 'numeric' })}`,
        ...w,
      }))
    }
    return [...stats.monthly].reverse().map((m) => ({
      key: m.month,
      label: new Date(`${m.month}-15T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      ...m,
    }))
  }, [stats, grain])

  if (loading) return <Spinner label="Loading calendar" />
  if (error) return <div className="p-6"><ErrorNote error={error} /></div>

  return (
    <>
      <PageHeader title="Calendar" subtitle="Daily results rolled into weeks and months" />
      <div className="space-y-5 px-4 py-5 lg:px-7">
        <Card>
          <PnlCalendar month={month} onMonthChange={setMonth} days={stats?.daily ?? []} />
        </Card>

        <Card>
          <CardHeader
            title="Period breakdown"
            right={
              <Segmented
                value={grain}
                onChange={setGrain}
                options={[
                  { value: 'day', label: 'Daily' },
                  { value: 'week', label: 'Weekly' },
                  { value: 'month', label: 'Monthly' },
                ]}
              />
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {['Period', 'Trades', 'W / L', 'Win rate', 'Total R', 'Net P&L'].map((h) => (
                    <th key={h} className="label px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r: any) => (
                  <tr key={r.key} className="hover:bg-surface-2/60">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium">{r.label}</td>
                    <td className="px-4 py-2.5 tnum text-ink-muted">{r.trades}</td>
                    <td className="px-4 py-2.5 tnum text-ink-muted">{r.wins} / {r.losses}</td>
                    <td className="px-4 py-2.5 tnum text-ink-muted">{pct(r.winRate, 0)}</td>
                    <td className={`px-4 py-2.5 tnum font-medium ${pnlClass(r.r)}`}>{rMultiple(r.r)}</td>
                    <td className={`px-4 py-2.5 tnum font-semibold ${pnlClass(r.pnl)}`}>{money(r.pnl, { sign: true })}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-faint">No trades logged yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}
