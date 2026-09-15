import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, SlidersHorizontal, Plus, X } from 'lucide-react'

import { api } from '@/lib/api'
import { useAsync, useDebounced, useReference, useStored } from '@/lib/hooks'
import { money, rMultiple, formatDay, pnlClass, todayISO } from '@/lib/format'
import type { Trade } from '@/lib/types'
import { PageHeader } from '@/components/Layout'
import { Card, Select, Input, Spinner, ErrorNote, EmptyState, Badge, Segmented } from '@/components/ui'
import { ComplianceBadge } from '@/components/RuleChecklist'

const RANGES = [
  { value: 'all', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'mtd', label: 'This month' },
  { value: 'ytd', label: 'This year' },
]

/** Turn a range preset into a `from` date the API understands. */
export function rangeStart(range: string): string | undefined {
  const now = new Date()
  if (range === 'all') return undefined
  if (range === 'mtd') return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  if (range === 'ytd') return `${now.getFullYear()}-01-01`
  const days = Number(range)
  if (!Number.isFinite(days)) return undefined
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Trades() {
  const reference = useReference()
  const [showFilters, setShowFilters] = useStored('tj-show-filters', false)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useStored<Record<string, string>>('tj-trade-filters', {
    range: 'all', asset_class: 'all', trade_style: 'all', option_side: 'all',
    setup: 'all', session: 'all', outcome: 'all', trade_source: 'all', symbol: '',
  })
  const debouncedSearch = useDebounced(search)

  const query = useMemo(
    () => ({ ...filters, range: undefined, from: rangeStart(filters.range), search: debouncedSearch }),
    [filters, debouncedSearch],
  )

  const { data: trades, loading, error } = useAsync<Trade[]>(() => api.trades.list(query), [JSON.stringify(query)])

  const set = (patch: Record<string, string>) => setFilters({ ...filters, ...patch })
  const activeCount = Object.entries(filters).filter(([k, v]) => k !== 'range' && v !== 'all' && v !== '').length
  const clear = () =>
    setFilters({
      range: 'all', asset_class: 'all', trade_style: 'all', option_side: 'all',
      setup: 'all', session: 'all', outcome: 'all', trade_source: 'all', symbol: '',
    })

  const totals = useMemo(() => {
    const list = trades ?? []
    const net = list.reduce((a, t) => a + (t.net_pnl ?? 0), 0)
    const decided = list.filter((t) => t.outcome === 'win' || t.outcome === 'loss')
    const wins = decided.filter((t) => t.outcome === 'win').length
    return { net, count: list.length, winRate: decided.length ? (wins / decided.length) * 100 : null }
  }, [trades])

  return (
    <>
      <PageHeader
        title="Trades"
        subtitle={
          trades
            ? `${totals.count} trade${totals.count === 1 ? '' : 's'} · net ${money(totals.net, { sign: true })}${
                totals.winRate !== null ? ` · ${totals.winRate.toFixed(0)}% win rate` : ''
              }`
            : undefined
        }
        actions={
          <>
            <button className={`btn-ghost ${activeCount ? '!border-accent/50 !text-accent' : ''}`} onClick={() => setShowFilters(!showFilters)}>
              <SlidersHorizontal size={15} /> Filters{activeCount ? ` (${activeCount})` : ''}
            </button>
            <Link className="btn-primary" to="/trades/new">
              <Plus size={15} /> Log trade
            </Link>
          </>
        }
      />

      <div className="space-y-4 px-4 py-5 lg:px-7">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes, lessons, ticker, trade type"
              className="!pl-9"
            />
          </div>
          <Segmented
            value={filters.range}
            onChange={(range) => set({ range })}
            options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
          />
        </div>

        {showFilters && (
          <Card className="p-4">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Select value={filters.asset_class} onChange={(e) => set({ asset_class: e.target.value })}
                options={[{ value: 'all', label: 'All instruments' }, { value: 'futures', label: 'Futures' }, { value: 'options', label: 'Options' }]} />
              <Select value={filters.trade_style} onChange={(e) => set({ trade_style: e.target.value })}
                options={[{ value: 'all', label: 'All styles' }, ...reference.values('style').map((v) => ({ value: v, label: v }))]} />
              <Select value={filters.option_side} onChange={(e) => set({ option_side: e.target.value })}
                options={[{ value: 'all', label: 'Buying and selling' }, { value: 'buy', label: 'Buying premium' }, { value: 'sell', label: 'Selling premium' }]} />
              <Select value={filters.setup} onChange={(e) => set({ setup: e.target.value })}
                options={[{ value: 'all', label: 'All trade types' }, ...reference.values('setup').map((v) => ({ value: v, label: v }))]} />
              <Select value={filters.session} onChange={(e) => set({ session: e.target.value })}
                options={[{ value: 'all', label: 'All sessions' }, ...reference.values('session').map((v) => ({ value: v, label: v }))]} />
              <Select value={filters.trade_source} onChange={(e) => set({ trade_source: e.target.value })}
                options={[{ value: 'all', label: 'All sources' }, ...reference.values('source').map((v) => ({ value: v, label: v }))]} />
              <Select value={filters.outcome} onChange={(e) => set({ outcome: e.target.value })}
                options={[{ value: 'all', label: 'All outcomes' }, { value: 'win', label: 'Wins' }, { value: 'loss', label: 'Losses' }, { value: 'breakeven', label: 'Breakeven' }]} />
              <Input value={filters.symbol} onChange={(e) => set({ symbol: e.target.value.toUpperCase() })} placeholder="Ticker" />
            </div>
            {activeCount > 0 && (
              <button className="btn-subtle mt-3 !px-0" onClick={clear}>
                <X size={14} /> Clear filters
              </button>
            )}
          </Card>
        )}

        <ErrorNote error={error} />

        {loading ? (
          <Spinner label="Loading trades" />
        ) : !trades?.length ? (
          <Card>
            <EmptyState
              title="No trades yet"
              body={activeCount ? 'No trades match these filters.' : 'Log your first trade to start building the record.'}
              action={
                activeCount ? (
                  <button className="btn-ghost" onClick={clear}>Clear filters</button>
                ) : (
                  <Link className="btn-primary" to="/trades/new"><Plus size={15} /> Log trade</Link>
                )
              }
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    {['#', 'Date', 'Ticker', 'Style', 'Trade type', 'Session', 'Rules', 'Risk', 'R', 'P&L', 'Grade'].map((h) => (
                      <th key={h} className="label whitespace-nowrap px-4 py-2.5 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {trades.map((t) => (
                    <tr key={t.id} className="transition hover:bg-surface-2/60">
                      <td className="px-4 py-2.5">
                        <Link to={`/trades/${t.id}`} className="font-semibold text-accent hover:underline tnum">#{t.trade_no}</Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted tnum">{formatDay(t.trade_date, { month: 'short', day: 'numeric' })}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">{t.symbol}</span>
                          <span className={`text-[10px] font-bold uppercase ${t.direction === 'short' ? 'text-loss' : 'text-win'}`}>
                            {t.direction === 'short' ? 'S' : 'L'}
                          </span>
                          {t.asset_class === 'options' && (
                            <span className="text-[10px] text-ink-faint">
                              {t.strike ? `${t.strike}${t.option_type?.[0] ?? ''}` : 'OPT'}
                              {t.option_side === 'sell' ? ' ·SELL' : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">{t.trade_style}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">{t.setup ?? '--'}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">{t.session ?? '--'}</td>
                      <td className="px-4 py-2.5"><ComplianceBadge checks={t.rule_checks} /></td>
                      <td className="px-4 py-2.5 text-ink-muted tnum">{money(t.risk_amount)}</td>
                      <td className={`px-4 py-2.5 font-semibold tnum ${pnlClass(t.result_r)}`}>{rMultiple(t.result_r)}</td>
                      <td className={`px-4 py-2.5 font-semibold tnum ${pnlClass(t.net_pnl)}`}>{money(t.net_pnl, { sign: true })}</td>
                      <td className="px-4 py-2.5">{t.execution_grade ? <Badge>{t.execution_grade}</Badge> : <span className="text-ink-faint">--</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  )
}
