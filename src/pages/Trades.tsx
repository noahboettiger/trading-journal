import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, SlidersHorizontal, Plus, X, Pencil, CircleDot } from 'lucide-react'

import { api } from '@/lib/api'
import { useAsync, useDebounced, useReference, useStored } from '@/lib/hooks'
import { money, rMultiple, formatDay, pnlClass, compactMoney } from '@/lib/format'
import type { Trade } from '@/lib/types'
import { PageHeader } from '@/components/Layout'
import { Card, CardHeader, Select, Input, Spinner, ErrorNote, EmptyState, Badge, Segmented } from '@/components/ui'
import { ComplianceBadge } from '@/components/RuleChecklist'
import { GRADES } from '@/lib/instruments'
import { useJournal } from '@/lib/journals'

const RANGES = [
  { value: 'all', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'mtd', label: 'This month' },
  { value: 'ytd', label: 'This year' },
]

const BLANK_FILTERS = {
  range: 'all', asset_class: 'all', trade_style: 'all', option_side: 'all',
  setup: 'all', session: 'all', outcome: 'all', trade_source: 'all',
  trade_rating: 'all', symbol: '',
}

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

/** Strike and expiry, for an options row. */
function contractLabel(t: Trade) {
  if (t.asset_class !== 'options') return null
  const parts = [t.strike ? `${t.strike}${t.option_type?.[0]?.toUpperCase() ?? ''}` : null]
  if (t.option_side === 'sell') parts.push('SELL')
  return parts.filter(Boolean).join(' · ')
}

function SymbolCell({ t }: { t: Trade }) {
  const contract = contractLabel(t)
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-semibold">{t.symbol}</span>
      <span className={`text-[10px] font-bold uppercase ${t.direction === 'short' ? 'text-loss' : 'text-win'}`}>
        {t.direction === 'short' ? 'S' : 'L'}
      </span>
      {contract && <span className="text-[10px] text-ink-faint">{contract}</span>}
    </div>
  )
}

function EditCell({ t }: { t: Trade }) {
  return (
    <Link
      to={`/trades/${t.id}/edit`}
      title={`Edit trade #${t.trade_no}`}
      aria-label={`Edit trade #${t.trade_no}`}
      className="inline-flex rounded-md p-1.5 text-ink-faint transition hover:bg-surface-2 hover:text-ink"
    >
      <Pencil size={14} />
    </Link>
  )
}

const TH = ({ children }: { children?: React.ReactNode }) => (
  <th className="label whitespace-nowrap px-3 py-2.5 font-semibold">{children}</th>
)
const TD = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => (
  <td className={`whitespace-nowrap px-3 py-2.5 ${className}`}>{children}</td>
)

/**
 * Open positions and closed trades answer different questions. A live
 * cash-secured put is about capital tied up and time left; a finished trade is
 * about what it returned. Same rows, different columns.
 */
function TradeTable({ title, subtitle, trades, variant }: {
  title?: string
  subtitle?: string
  trades: Trade[]
  variant: 'open' | 'closed'
}) {
  if (!trades.length) return null
  const isOpen = variant === 'open'

  return (
    <Card className="overflow-hidden">
      {title && (
        <CardHeader
          title={title}
          subtitle={subtitle}
          icon={isOpen ? <CircleDot size={15} className="text-accent" /> : undefined}
          right={<Badge tone={isOpen ? 'accent' : 'neutral'}>{trades.length}</Badge>}
        />
      )}
      <div className="overflow-x-auto">
        <table className={`w-full text-sm ${isOpen ? 'min-w-[900px]' : 'min-w-[1120px]'}`}>
          <thead>
            <tr className="border-b border-line text-left">
              <TH>#</TH>
              <TH>{isOpen ? 'Opened' : 'Date'}</TH>
              <TH>Ticker</TH>
              <TH>Style</TH>
              <TH>Entry model</TH>
              {isOpen ? (
                <>
                  <TH>Size</TH>
                  <TH>Held</TH>
                  <TH>DTE left</TH>
                  <TH>Capital</TH>
                  <TH>Credit</TH>
                </>
              ) : (
                <>
                  <TH>Session</TH>
                  <TH>Rules</TH>
                  <TH>Risk</TH>
                  <TH>R</TH>
                  <TH>P&L</TH>
                  <TH>Setup</TH>
                  <TH>Exec</TH>
                </>
              )}
              <TH />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {trades.map((t) => (
              <tr key={t.id} className="transition hover:bg-surface-2/60">
                <TD>
                  <Link to={`/trades/${t.id}`} className="font-semibold text-accent hover:underline tnum">#{t.trade_no}</Link>
                </TD>
                <TD className="text-ink-muted tnum">{formatDay(t.trade_date, { month: 'short', day: 'numeric' })}</TD>
                <TD><SymbolCell t={t} /></TD>
                <TD className="text-ink-muted">{t.trade_style}</TD>
                <TD className="text-ink-muted">{t.setup ?? '--'}</TD>

                {isOpen ? (
                  <>
                    <TD className="text-ink-muted tnum">
                      {t.contracts_closed > 0 && t.contracts_remaining !== null
                        ? `${t.contracts_remaining}/${t.contracts_opened}`
                        : (t.contracts ?? '--')}
                    </TD>
                    <TD className="text-ink-muted tnum">{t.days_held === null ? '--' : `${t.days_held}d`}</TD>
                    <TD className={`tnum ${(t.dte_exit ?? 99) <= 7 ? 'text-loss font-semibold' : 'text-ink-muted'}`}>
                      {t.dte_exit === null ? '--' : `${t.dte_exit}d`}
                    </TD>
                    <TD className="text-ink-muted tnum">
                      {compactMoney(t.collateral_required ?? t.risk_amount)}
                    </TD>
                    <TD className="font-semibold text-win tnum">{money(t.credit_received)}</TD>
                  </>
                ) : (
                  <>
                    <TD className="text-ink-muted">{t.session ?? '--'}</TD>
                    <TD><ComplianceBadge checks={t.rule_checks} compact /></TD>
                    <TD className="text-ink-muted tnum">{money(t.risk_amount)}</TD>
                    <TD className={`font-semibold tnum ${pnlClass(t.result_r)}`}>{rMultiple(t.result_r)}</TD>
                    <TD className={`font-semibold tnum ${pnlClass(t.net_pnl)}`}>{money(t.net_pnl, { sign: true })}</TD>
                    <TD>{t.trade_rating ? <Badge>{t.trade_rating}</Badge> : <span className="text-ink-faint">--</span>}</TD>
                    <TD>{t.execution_grade ? <Badge>{t.execution_grade}</Badge> : <span className="text-ink-faint">--</span>}</TD>
                  </>
                )}
                <TD><EditCell t={t} /></TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default function Trades() {
  const reference = useReference()
  const { journalId, journal } = useJournal()
  const [showFilters, setShowFilters] = useStored('tj-show-filters', false)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useStored<Record<string, string>>('tj-trade-filters', BLANK_FILTERS)
  const debouncedSearch = useDebounced(search)

  const query = useMemo(
    () => ({
      ...filters,
      range: undefined,
      from: rangeStart(filters.range),
      search: debouncedSearch,
      journal_id: journalId ?? undefined,
    }),
    [filters, debouncedSearch, journalId],
  )

  const { data: trades, loading, error } = useAsync<Trade[]>(
    () => (journalId === null ? Promise.resolve([]) : api.trades.list(query)),
    [JSON.stringify(query)],
  )

  const set = (patch: Record<string, string>) => setFilters({ ...filters, ...patch })
  const activeCount = Object.entries(filters).filter(([k, v]) => k !== 'range' && v !== 'all' && v !== '').length
  const clear = () => setFilters(BLANK_FILTERS)

  const open = useMemo(() => (trades ?? []).filter((t) => t.status === 'open'), [trades])
  const closed = useMemo(() => (trades ?? []).filter((t) => t.status !== 'open'), [trades])
  const openCapital = useMemo(
    () => open.reduce((a, t) => a + (t.collateral_required ?? t.risk_amount ?? 0), 0),
    [open],
  )

  const totals = useMemo(() => {
    const net = closed.reduce((a, t) => a + (t.net_pnl ?? 0), 0)
    const decided = closed.filter((t) => t.outcome === 'win' || t.outcome === 'loss')
    const wins = decided.filter((t) => t.outcome === 'win').length
    return { net, winRate: decided.length ? (wins / decided.length) * 100 : null }
  }, [closed])

  return (
    <>
      <PageHeader
        title={journal ? `${journal.name} trades` : 'Trades'}
        subtitle={
          trades
            ? [
                open.length ? `${open.length} open` : null,
                `${closed.length} closed`,
                `net ${money(totals.net, { sign: true })}`,
                totals.winRate !== null ? `${totals.winRate.toFixed(0)}% win rate` : null,
              ]
                .filter(Boolean)
                .join(' · ')
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
              placeholder="Search notes, thesis, lessons, ticker, entry model"
              className="!pl-9"
            />
          </div>
          <Segmented value={filters.range} onChange={(range) => set({ range })} options={RANGES} />
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
                options={[{ value: 'all', label: 'All entry models' }, ...reference.values('setup').map((v) => ({ value: v, label: v }))]} />
              <Select value={filters.trade_rating} onChange={(e) => set({ trade_rating: e.target.value })}
                options={[{ value: 'all', label: 'All setup ratings' }, ...GRADES.map((v) => ({ value: v, label: `${v} setups` }))]} />
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
          <>
            <TradeTable
              title="Open Positions"
              subtitle={
                openCapital
                  ? `${money(openCapital, { cents: false })} tied up, not counted in realised P&L`
                  : 'Still live, not counted in realised P&L'
              }
              trades={open}
              variant="open"
            />
            <TradeTable title={open.length ? 'Closed Trades' : undefined} trades={closed} variant="closed" />
          </>
        )}
      </div>
    </>
  )
}
