import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  LineChart as ChartIcon, Pencil, ArrowLeft, Compass, Target, DollarSign,
  Award, TrendingUp, Clock, CalendarClock, Star, ArrowRight, RefreshCw,
} from 'lucide-react'

import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { money, rMultiple, pct, formatDay, pnlClass, ratio, num } from '@/lib/format'
import { CLOSE_METHOD_LABELS, optionTypeLabel } from '@/lib/instruments'
import type { Trade } from '@/lib/types'
import { PageHeader } from '@/components/Layout'
import { Card, CardHeader, Badge, Spinner, ErrorNote, EmptyState } from '@/components/ui'
import { RuleChecklist, ComplianceBadge } from '@/components/RuleChecklist'
import { parseMulti } from '@shared/calc.js'

function FieldRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 border-b border-line py-2.5 last:border-0">
      {icon && <span className="mt-[3px] text-ink-faint">{icon}</span>}
      <div className="min-w-0">
        <div className="label">{label}</div>
        <div className="mt-0.5 truncate text-sm font-semibold">{value ?? '--'}</div>
      </div>
    </div>
  )
}

function ReviewBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{children}</div>
    </div>
  )
}

export default function TradeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: trade, loading, error } = useAsync<Trade>(() => api.trades.get(Number(id)), [id])

  if (loading) return <Spinner label="Loading trade" />
  if (error) return <div className="p-6"><ErrorNote error={error} /></div>
  if (!trade) return <EmptyState title="Trade not found" action={<Link className="btn-ghost" to="/trades">Back to trades</Link>} />

  const isOptions = trade.asset_class === 'options'
  const isSelling = isOptions && trade.option_side === 'sell'
  const dateLabel = formatDay(trade.trade_date)

  const summary: { label: string; value: React.ReactNode; icon: React.ReactNode; cls: string }[] = isSelling
    ? [
        { label: 'Credit taken in', value: money(trade.credit_received), icon: <DollarSign size={15} />, cls: '' },
        { label: 'Collateral', value: money(trade.collateral_required, { cents: false }), icon: <Compass size={15} />, cls: '' },
        { label: 'Net P&L', value: money(trade.net_pnl, { sign: true }), icon: <TrendingUp size={15} />, cls: pnlClass(trade.net_pnl) },
        {
          label: 'Return on collateral',
          value: pct(trade.return_on_collateral, 2),
          icon: <Target size={15} />,
          cls: pnlClass(trade.return_on_collateral),
        },
        {
          label: 'Annualised',
          value: pct(trade.annualised_return, 1),
          icon: <Award size={15} />,
          cls: pnlClass(trade.annualised_return),
        },
      ]
    : [
    { label: 'Direction', value: trade.direction === 'short' ? 'Short' : 'Long', icon: <Compass size={15} />, cls: '' },
    {
      label: 'Risk / Reward',
      value: trade.result_r === null ? '--' : rMultiple(trade.result_r),
      icon: <Target size={15} />,
      cls: pnlClass(trade.result_r),
    },
    { label: 'P&L', value: money(trade.net_pnl, { sign: true }), icon: <DollarSign size={15} />, cls: pnlClass(trade.net_pnl) },
    {
      label: 'Outcome',
      value: trade.outcome ? trade.outcome[0].toUpperCase() + trade.outcome.slice(1) : '--',
      icon: <TrendingUp size={15} />,
      cls: trade.outcome === 'win' ? 'text-win' : trade.outcome === 'loss' ? 'text-loss' : '',
    },
    { label: 'Setup', value: trade.trade_rating ?? '--', icon: <Star size={15} />, cls: '' },
    { label: 'Execution', value: trade.execution_grade ?? '--', icon: <Award size={15} />, cls: '' },
  ]

  return (
    <>
      <PageHeader
        title={`Trade #${trade.trade_no}`}
        subtitle={`${trade.symbol} · ${trade.trade_style} · ${dateLabel}`}
        actions={
          <>
            <button className="btn-ghost" onClick={() => navigate('/trades')}>
              <ArrowLeft size={15} /> All trades
            </button>
            <Link className="btn-primary" to={`/trades/${trade.id}/edit`}>
              <Pencil size={15} /> Edit
            </Link>
          </>
        }
      />

      <div className="space-y-5 px-4 py-5 lg:px-7">
        {/* Chart snapshot */}
        <Card>
          <CardHeader
            title="Chart Snapshot"
            icon={<ChartIcon size={15} />}
            right={
              <span className="text-xs font-medium text-ink-faint">
                #{trade.trade_no} · {trade.symbol} - {dateLabel}
              </span>
            }
          />
          {trade.images.length ? (
            <div className="space-y-4 p-4 lg:p-5">
              {trade.images.map((img) => (
                <figure key={img.path} className="overflow-hidden rounded-lg bg-surface-2">
                  <img src={img.path} alt={img.caption ?? 'Chart snapshot'} className="mx-auto max-h-[560px] w-auto max-w-full object-contain" />
                  {img.caption && <figcaption className="border-t border-line px-4 py-2 text-xs text-ink-faint">{img.caption}</figcaption>}
                </figure>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<ChartIcon size={26} />}
              title="No chart attached"
              body="Add a screenshot when you edit this trade."
            />
          )}
        </Card>

        {/* Summary, directly under the chart where the eye lands first */}
        <Card>
          <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-6">
            {summary.map((s) => (
              <div key={s.label} className="flex items-center gap-3 px-5 py-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-muted">
                  {s.icon}
                </span>
                <div className="min-w-0">
                  <div className="label">{s.label}</div>
                  <div className={`truncate text-base font-semibold tnum ${s.cls}`}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Trade fields, full width */}
        <Card>
          <CardHeader title="Trade Fields" />
          <div className="grid gap-x-6 px-5 py-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <FieldRow label="Trade number" value={`#${trade.trade_no}`} />
              <FieldRow label="Ticker" value={trade.symbol} />
              <FieldRow label="Direction" value={trade.direction === 'short' ? 'Short' : 'Long'} />
              <FieldRow label="Instrument" value={isOptions ? 'Options' : 'Futures'} />
              <FieldRow label="Trade style" value={trade.trade_style} />
              <FieldRow label="Entry model" value={trade.setup} />
              <FieldRow label="Session" value={trade.session} />
              <FieldRow label="Timeframe" value={trade.timeframe} />
              <FieldRow label="Source" value={trade.trade_source} />
              <FieldRow label="Journal" value={trade.journal_name} />
              <FieldRow label="Entry date" value={dateLabel} />
              <FieldRow label="Exit date" value={trade.exit_date ? formatDay(trade.exit_date) : 'Same day'} />
              <FieldRow label="Days held" value={trade.days_held === null ? '--' : `${trade.days_held}d`} icon={<Clock size={13} />} />

              {isOptions ? (
                <>
                  <FieldRow label="Contract" value={trade.strike ? `${num(trade.strike)} ${optionTypeLabel(trade.option_type)}`.trim() : '--'} />
                  <FieldRow label="Side" value={trade.option_side === 'sell' ? 'Selling premium' : trade.option_side === 'buy' ? 'Buying premium' : '--'} />
                  <FieldRow label="Expiration" value={trade.expiration ? formatDay(trade.expiration) : '--'} icon={<CalendarClock size={13} />} />
                  <FieldRow label="Contracts" value={num(trade.contracts)} />
                  <FieldRow label="Entry premium" value={trade.entry_premium === null ? '--' : `$${num(trade.entry_premium)}`} />
                  <FieldRow label="Exit premium" value={trade.exit_premium === null ? '--' : `$${num(trade.exit_premium)}`} />
                  <FieldRow label="DTE at entry" value={trade.dte_entry === null ? '--' : `${trade.dte_entry}d`} />
                  <FieldRow label="DTE at exit" value={trade.dte_exit === null ? '--' : `${trade.dte_exit}d`} />
                  {trade.close_method && (
                    <FieldRow label="How it closed" value={CLOSE_METHOD_LABELS[trade.close_method] ?? trade.close_method} />
                  )}
                  {isSelling ? (
                    <>
                      {trade.roll_count > 0 && (
                        <FieldRow label="Rolls" value={`${trade.roll_count}`} icon={<RefreshCw size={13} />} />
                      )}
                      <FieldRow
                        label={trade.roll_count ? `Credit, all ${trade.roll_count + 1} legs` : 'Credit taken in'}
                        value={money(trade.credit_received)}
                      />
                      {trade.roll_count > 0 && (
                        <FieldRow label="Paid to close legs" value={money(trade.buyback_cost)} />
                      )}
                      <FieldRow label="Collateral" value={money(trade.collateral_required, { cents: false })} />
                      <FieldRow
                        label="Return on collateral"
                        value={<span className={pnlClass(trade.return_on_collateral)}>{pct(trade.return_on_collateral, 2)}</span>}
                      />
                      <FieldRow
                        label="Annualised return"
                        value={<span className={pnlClass(trade.annualised_return)}>{pct(trade.annualised_return, 1)}</span>}
                      />
                      <FieldRow
                        label="Max profit captured"
                        value={
                          <span className={trade.pct_of_max_profit !== null && trade.pct_of_max_profit >= 50 ? 'text-win' : ''}>
                            {pct(trade.pct_of_max_profit, 0)}
                          </span>
                        }
                      />
                    </>
                  ) : (
                    <FieldRow label="Return on risk" value={pct(trade.return_on_risk)} />
                  )}
                  {trade.delta !== null && <FieldRow label="Delta" value={num(trade.delta)} />}
                  {trade.iv_at_entry !== null && <FieldRow label="IV at entry" value={pct(trade.iv_at_entry)} />}
                  {trade.underlying_entry !== null && <FieldRow label="Underlying entry" value={num(trade.underlying_entry)} />}
                </>
              ) : (
                <>
                  <FieldRow label="Contracts" value={num(trade.contracts)} />
                  <FieldRow label="Entry price" value={num(trade.entry_price)} />
                  <FieldRow label="Exit price" value={num(trade.exit_price)} />
                  <FieldRow label="Point value" value={trade.point_value === null ? '--' : `$${num(trade.point_value)}`} />
                  {/* No longer collected on the form, so only shown for trades that have them. */}
                  {trade.stop_price !== null && <FieldRow label="Stop loss" value={num(trade.stop_price)} />}
                  {trade.target_price !== null && <FieldRow label="Target" value={num(trade.target_price)} />}
                </>
              )}

              <FieldRow label="Risk ($)" value={money(trade.risk_amount)} />
              <FieldRow label="Result R" value={<span className={pnlClass(trade.result_r)}>{rMultiple(trade.result_r)}</span>} />
              <FieldRow label="Net P&L" value={<span className={pnlClass(trade.net_pnl)}>{money(trade.net_pnl, { sign: true })}</span>} />
              <FieldRow label="Trade rating" value={trade.trade_rating} />
              <FieldRow label="Execution grade" value={trade.execution_grade} />
              {trade.planned_rr !== null && (
                <FieldRow label="Planned R:R" value={`${ratio(trade.planned_rr)}:1`} />
              )}
              {!!trade.commissions && <FieldRow label="Commissions" value={money(trade.commissions)} />}
          </div>
        </Card>

        {isOptions && trade.cash_flows.length > 1 && (
          <Card>
            <CardHeader
              title={trade.roll_count ? 'Position History' : 'Cash Flow'}
              icon={<RefreshCw size={15} />}
              subtitle={
                trade.roll_count
                  ? 'One position managed over time, not separate trades'
                  : 'Every fill and what it moved'
              }
              right={
                trade.roll_count ? (
                  <Badge tone="accent">{trade.roll_count} roll{trade.roll_count === 1 ? '' : 's'}</Badge>
                ) : undefined
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    {['Date', 'Action', 'Contract', 'Price', 'Cash'].map((h) => (
                      <th key={h} className="label whitespace-nowrap px-4 py-2.5 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {trade.cash_flows.map((f, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted tnum">
                        {f.date ? formatDay(f.date, { month: 'short', day: 'numeric' }) : '--'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium">
                        {f.kind === 'open' ? 'Opened' : f.kind === 'roll-close' ? 'Bought back' : f.kind === 'roll' ? 'Rolled into' : 'Closed'}
                        {f.kind === 'roll' && f.isNetPrice && (
                          <span className="ml-2 text-[11px] text-ink-faint">net price</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">
                        {f.strike
                          ? `${num(f.strike)} ${optionTypeLabel(trade.option_type)}${
                              f.expiration ? ` exp ${formatDay(f.expiration, { month: 'short', day: 'numeric' })}` : ''
                            }`
                          : '--'}
                        {f.contracts ? <span className="ml-2 text-[11px] text-ink-faint">x{num(f.contracts)}</span> : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted tnum">
                        {f.premium === null ? '--' : num(f.premium)}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-2.5 font-semibold tnum ${pnlClass(f.amount)}`}>
                        {f.amount === null ? '--' : money(f.amount, { sign: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 text-xs text-ink-muted">
              <span className="font-semibold text-win">{money(trade.credit_received)} in</span>
              <ArrowRight size={13} className="text-ink-faint" />
              <span className="text-loss">{money(trade.buyback_cost)} out</span>
              <ArrowRight size={13} className="text-ink-faint" />
              <span className={`font-semibold ${pnlClass(trade.net_pnl)}`}>
                {trade.net_pnl === null ? 'still open' : `${money(trade.net_pnl, { sign: true })} net`}
              </span>
              <span className="ml-auto text-ink-faint">
                {trade.days_held === null ? '' : `${trade.days_held} days across the campaign`}
              </span>
            </div>
          </Card>
        )}

        {/* Rules: the itemized checklist, read-only */}
        <Card>
          <CardHeader
            title="Rule Compliance"
            subtitle={trade.playbook_name ?? 'No playbook'}
            right={<ComplianceBadge checks={trade.rule_checks} />}
          />
          <RuleChecklist checks={trade.rule_checks} readOnly columns />
        </Card>

        {/* Review content */}
        <Card>
          <CardHeader title="Review" />
          <div className="border-b border-line p-5">
            <ReviewBlock label="Thesis - why I took it">{trade.thesis || 'No thesis recorded.'}</ReviewBlock>
          </div>
          <div className="grid gap-6 p-5 lg:grid-cols-3">
            <ReviewBlock label="Emotional state">
              {trade.emotional_state ? (
                <span className="flex flex-wrap gap-1.5">
                  {parseMulti(trade.emotional_state).map((mood) => (
                    <Badge key={mood} tone="accent">{mood}</Badge>
                  ))}
                </span>
              ) : (
                'Not recorded.'
              )}
            </ReviewBlock>
            <ReviewBlock label="Mistake tags">
              {trade.tags.length ? (
                <span className="flex flex-wrap gap-1.5">
                  {trade.tags.map((t) => (
                    <Badge key={t.id} tone="loss">{t.name}</Badge>
                  ))}
                </span>
              ) : (
                'No mistakes tagged.'
              )}
            </ReviewBlock>
            <ReviewBlock label="Notes - what happened">{trade.notes || 'No notes saved.'}</ReviewBlock>
            <ReviewBlock label="Lesson learned">{trade.lesson_learned || 'No lesson saved.'}</ReviewBlock>
            <ReviewBlock label="Reflections">{trade.reflections || 'No reflections saved.'}</ReviewBlock>
          </div>
        </Card>

      </div>
    </>
  )
}
