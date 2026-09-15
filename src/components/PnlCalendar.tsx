import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { compactMoney, money, toISODate } from '@/lib/format'
import type { DayRollup } from '@/lib/types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Month grid of daily P&L with a running week total in the trailing column,
 * so a day, its week and the month all read off one view.
 */
export function PnlCalendar({
  month,
  onMonthChange,
  days,
}: {
  month: Date
  onMonthChange: (next: Date) => void
  days: DayRollup[]
}) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days])

  const { weeks, monthTotal, monthTrades } = useMemo(() => {
    const year = month.getFullYear()
    const m = month.getMonth()
    const first = new Date(year, m, 1)
    const start = new Date(first)
    start.setDate(first.getDate() - first.getDay()) // back to Sunday

    const rows: { date: Date; inMonth: boolean; rollup?: DayRollup }[][] = []
    const cursor = new Date(start)
    let total = 0
    let trades = 0

    for (let w = 0; w < 6; w++) {
      const row: { date: Date; inMonth: boolean; rollup?: DayRollup }[] = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(cursor)
        const inMonth = date.getMonth() === m
        const rollup = byDate.get(toISODate(date))
        if (inMonth && rollup) {
          total += rollup.pnl
          trades += rollup.trades
        }
        row.push({ date, inMonth, rollup })
        cursor.setDate(cursor.getDate() + 1)
      }
      rows.push(row)
      // Stop once we have covered the month and finished the week.
      if (cursor.getMonth() !== m && cursor > new Date(year, m + 1, 0)) break
    }
    return { weeks: rows, monthTotal: total, monthTrades: trades }
  }, [month, byDate])

  const today = toISODate(new Date())
  const shift = (delta: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1))

  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 lg:px-5">
        <button className="btn-ghost !px-2" onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold">
            {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
          <div className={`text-xs tnum ${monthTotal > 0 ? 'text-win' : monthTotal < 0 ? 'text-loss' : 'text-ink-faint'}`}>
            {monthTrades ? `${money(monthTotal, { sign: true })} · ${monthTrades} trade${monthTrades === 1 ? '' : 's'}` : 'No trades'}
          </div>
        </div>
        <button className="btn-ghost !px-2" onClick={() => shift(1)} aria-label="Next month">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="border-t border-line">
        <div className="p-2 lg:p-3">
          <div className="grid grid-cols-7 gap-1 sm:grid-cols-[repeat(7,minmax(0,1fr))_86px] sm:gap-1.5">
            {WEEKDAYS.map((d) => (
              <div key={d} className="label py-1.5 text-center text-[9px] sm:text-[11px]">
                <span className="sm:hidden">{d[0]}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
            <div className="label hidden py-1.5 text-center sm:block">Week</div>

            {weeks.map((row, wi) => {
              const weekPnl = row.reduce((a, c) => a + (c.inMonth ? (c.rollup?.pnl ?? 0) : 0), 0)
              const weekTrades = row.reduce((a, c) => a + (c.inMonth ? (c.rollup?.trades ?? 0) : 0), 0)
              return (
                <FragmentRow key={wi}>
                  {row.map(({ date, inMonth, rollup }) => {
                    const iso = toISODate(date)
                    const pnl = rollup?.pnl ?? null
                    const tone =
                      !inMonth || pnl === null
                        ? 'border-line bg-surface-1'
                        : pnl > 0
                          ? 'border-win/30 bg-win/10'
                          : pnl < 0
                            ? 'border-loss/30 bg-loss/10'
                            : 'border-line bg-surface-2'
                    const cell = (
                      <div
                        className={`flex h-[58px] flex-col justify-between rounded-md border p-1 transition sm:h-[74px] sm:rounded-lg sm:p-1.5 ${tone} ${
                          inMonth ? '' : 'opacity-35'
                        } ${rollup ? 'hover:brightness-110' : ''} ${iso === today ? 'ring-1 ring-accent/50' : ''}`}
                      >
                        <span className={`text-[10px] font-semibold tnum sm:text-[11px] ${inMonth ? 'text-ink-muted' : 'text-ink-faint'}`}>
                          {date.getDate()}
                        </span>
                        {rollup && inMonth && (
                          <span>
                            <span className={`block truncate text-[10px] font-bold leading-tight tnum sm:text-[13px] ${pnl! > 0 ? 'text-win' : pnl! < 0 ? 'text-loss' : 'text-ink-muted'}`}>
                              {compactMoney(pnl)}
                            </span>
                            <span className="block truncate text-[9px] text-ink-faint tnum sm:text-[10px]">
                              {rollup.winRate === null ? `${rollup.trades}t` : `${rollup.winRate.toFixed(0)}% · ${rollup.trades}t`}
                            </span>
                          </span>
                        )}
                      </div>
                    )
                    return rollup && inMonth ? (
                      <Link key={iso} to={`/trades?date=${iso}`} title={`${iso}: ${money(pnl)}`}>{cell}</Link>
                    ) : (
                      <div key={iso}>{cell}</div>
                    )
                  })}

                  <div className={`hidden h-[74px] flex-col justify-center rounded-lg border px-2 sm:flex ${
                    weekTrades ? (weekPnl > 0 ? 'border-win/25 bg-win/5' : weekPnl < 0 ? 'border-loss/25 bg-loss/5' : 'border-line bg-surface-2') : 'border-dashed border-line bg-transparent'
                  }`}>
                    {weekTrades ? (
                      <>
                        <span className={`text-[13px] font-bold leading-tight tnum ${weekPnl > 0 ? 'text-win' : weekPnl < 0 ? 'text-loss' : 'text-ink-muted'}`}>
                          {compactMoney(weekPnl)}
                        </span>
                        <span className="text-[10px] text-ink-faint tnum">{weekTrades} trade{weekTrades === 1 ? '' : 's'}</span>
                      </>
                    ) : (
                      <span className="text-[10px] text-ink-faint">--</span>
                    )}
                  </div>
                </FragmentRow>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Grid children must be direct descendants, so a row is just a fragment. */
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
