import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, Trash2, ChevronDown, Calculator } from 'lucide-react'

import { api } from '@/lib/api'
import { useAsync, useReference } from '@/lib/hooks'
import { money, rMultiple, pct, todayISO, pnlClass, ratio } from '@/lib/format'
import { pointValueFor, GRADES, ASSET_CLASSES, DIRECTIONS, OPTION_SIDES, STATUSES } from '@/lib/instruments'
import type { RuleCheck, Trade, TradeImage } from '@/lib/types'
import { PageHeader } from '@/components/Layout'
import { Card, CardHeader, Field, Input, Select, Textarea, Badge, Spinner, ErrorNote } from '@/components/ui'
import { RuleChecklist } from '@/components/RuleChecklist'
import { ChartUpload } from '@/components/ChartUpload'
import {
  deriveGrossPnl, deriveNetPnl, deriveRiskAmount, plannedRR, resultR,
  daysHeld, dteAtEntry, dteAtExit, returnOnRisk,
} from '@shared/calc.js'

type FormState = Record<string, any>

const BLANK: FormState = {
  asset_class: 'futures',
  trade_style: 'Day Trade',
  symbol: '',
  direction: 'long',
  status: 'closed',
  trade_date: todayISO(),
  commissions: '',
  images: [] as TradeImage[],
  rule_checks: [] as RuleCheck[],
  tag_ids: [] as number[],
}

/** Strings from inputs become numbers or null before any math or save. */
const n = (v: any) => {
  if (v === '' || v === null || v === undefined) return null
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : null
}

/** Numeric view of the form, which is what the shared calc helpers expect. */
function numeric(form: FormState) {
  const out: Record<string, any> = { ...form }
  for (const k of [
    'contracts', 'entry_price', 'exit_price', 'stop_price', 'target_price', 'point_value',
    'strike', 'entry_premium', 'exit_premium', 'underlying_entry', 'underlying_stop',
    'underlying_target', 'delta', 'theta', 'vega', 'iv_at_entry', 'risk_amount',
    'gross_pnl', 'net_pnl', 'commissions', 'result_r_override',
  ]) {
    out[k] = n(form[k])
  }
  return out
}

export default function TradeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id
  const reference = useReference()

  const [form, setForm] = useState<FormState>(BLANK)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [showGreeks, setShowGreeks] = useState(false)
  const [gradingStarted, setGradingStarted] = useState(isEdit)
  const [loaded, setLoaded] = useState(!isEdit)

  const nextNo = useAsync(() => (isEdit ? Promise.resolve(null) : api.trades.nextNumber()), [isEdit])

  // Load an existing trade for editing.
  useEffect(() => {
    if (!isEdit) return
    api.trades
      .get(Number(id))
      .then((t: Trade) => {
        const f: FormState = { ...t }
        for (const [k, v] of Object.entries(f)) if (v === null) f[k] = ''
        f.images = t.images ?? []
        f.rule_checks = t.rule_checks ?? []
        f.tag_ids = (t.tags ?? []).map((tag) => tag.id)
        setForm(f)
        setLoaded(true)
      })
      .catch(setError)
  }, [id, isEdit])

  const set = (patch: FormState) => setForm((f) => ({ ...f, ...patch }))

  const isOptions = form.asset_class === 'options'
  const calc = useMemo(() => numeric(form), [form])

  // Live preview. Typed values win; blanks fall back to the derivation.
  const grossPreview = n(form.gross_pnl) ?? deriveGrossPnl(calc)
  const netPreview = n(form.net_pnl) ?? deriveNetPnl({ ...calc, gross_pnl: grossPreview })
  const riskPreview = n(form.risk_amount) ?? deriveRiskAmount(calc)
  const rrPreview = plannedRR(calc)
  const rPreview = resultR({ ...calc, net_pnl: netPreview, risk_amount: riskPreview })
  const held = daysHeld(form)
  const dteIn = dteAtEntry(form)
  const dteOut = dteAtExit(form)
  const ror = returnOnRisk({ ...calc, net_pnl: netPreview, risk_amount: riskPreview })

  /**
   * Attach the selected playbook's rules, snapshotting their text. Checks
   * already made are carried across by rule id so switching playbooks by
   * accident does not wipe the work.
   */
  const applyPlaybook = (playbookId: string) => {
    const pb = reference.playbooks.find((p) => String(p.id) === String(playbookId))
    const previous = new Map<number, RuleCheck>()
    for (const c of form.rule_checks as RuleCheck[]) if (c.rule_id) previous.set(c.rule_id, c)

    const checks: RuleCheck[] = (pb?.rules ?? [])
      .filter((r) => r.is_active)
      .map((r, i) => ({
        rule_id: r.id ?? null,
        section: r.section,
        rule_text: r.text,
        is_critical: r.is_critical,
        checked: r.id ? (previous.get(r.id)?.checked ?? false) : false,
        note: r.id ? (previous.get(r.id)?.note ?? null) : null,
        sort_order: i,
      }))
    set({ playbook_id: playbookId, rule_checks: checks })
  }

  // Default a new trade to the first playbook matching the instrument type.
  useEffect(() => {
    if (isEdit || !reference.playbooks.length || form.playbook_id) return
    const match = reference.playbooks.find((p) => p.asset_class === form.asset_class) ?? reference.playbooks[0]
    if (match) applyPlaybook(String(match.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference.playbooks, form.asset_class, isEdit])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload: FormState = {
        ...numeric(form),
        symbol: String(form.symbol || '').trim().toUpperCase(),
        gross_pnl: n(form.gross_pnl),
        net_pnl: n(form.net_pnl),
        risk_amount: n(form.risk_amount),
        rule_checks: form.rule_checks,
        tag_ids: form.tag_ids,
        images: form.images,
      }
      // A blank money field means "derive it on the server", so drop the key
      // entirely rather than sending null, which would be an explicit value.
      for (const k of ['gross_pnl', 'net_pnl', 'risk_amount', 'outcome']) {
        if (payload[k] === null || payload[k] === '') delete payload[k]
      }
      const saved = isEdit ? await api.trades.update(Number(id), payload) : await api.trades.create(payload)
      navigate(`/trades/${saved.id}`)
    } catch (e) {
      setError(e)
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!isEdit || !confirm('Delete this trade permanently?')) return
    await api.trades.remove(Number(id))
    navigate('/trades')
  }

  if (!loaded) return <Spinner label="Loading trade" />

  const opt = (kind: any) => reference.values(kind)

  return (
    <>
      <PageHeader
        title={isEdit ? `Edit trade #${form.trade_no}` : `Log trade${nextNo.data ? ` #${nextNo.data.trade_no}` : ''}`}
        subtitle={isEdit ? 'Changes save to the same trade number' : 'Number is assigned automatically'}
        actions={
          <>
            {isEdit && (
              <button className="btn-danger" onClick={remove}>
                <Trash2 size={15} /> Delete
              </button>
            )}
            <button className="btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving || !form.symbol}>
              <Save size={15} /> {saving ? 'Saving...' : 'Save trade'}
            </button>
          </>
        }
      />

      <div className="space-y-5 px-4 py-5 lg:px-7">
        <ErrorNote error={error} />

        {/* Live math strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Net P&L', value: netPreview === null ? '--' : money(netPreview, { sign: true }), cls: pnlClass(netPreview) },
            { label: 'Result', value: rPreview === null ? '--' : rMultiple(rPreview), cls: pnlClass(rPreview) },
            { label: 'Risk', value: riskPreview === null ? '--' : money(riskPreview), cls: 'text-ink' },
            { label: 'Planned R:R', value: rrPreview === null ? '--' : `${ratio(rrPreview)}:1`, cls: 'text-ink' },
            isOptions
              ? { label: 'Return on risk', value: ror === null ? '--' : pct(ror), cls: pnlClass(ror) }
              : { label: 'Gross P&L', value: grossPreview === null ? '--' : money(grossPreview, { sign: true }), cls: pnlClass(grossPreview) },
            isOptions
              ? { label: 'DTE in → out', value: dteIn === null ? '--' : `${dteIn} → ${dteOut ?? '--'}`, cls: 'text-ink' }
              : { label: 'Days held', value: held === null ? '--' : `${held}d`, cls: 'text-ink' },
          ].map((s) => (
            <div key={s.label} className="card px-3.5 py-2.5">
              <div className="label">{s.label}</div>
              <div className={`mt-1 text-lg font-semibold tnum ${s.cls}`}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-5">
            {/* Category */}
            <Card>
              <CardHeader title="Trade category" icon={<Calculator size={15} />} />
              <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Instrument type">
                  <Select
                    value={form.asset_class}
                    options={ASSET_CLASSES}
                    onChange={(e) => set({ asset_class: e.target.value })}
                  />
                </Field>
                <Field label="Trade style">
                  <Select
                    value={form.trade_style ?? ''}
                    options={opt('style')}
                    placeholder="Select"
                    onChange={(e) => set({ trade_style: e.target.value })}
                  />
                </Field>
                <Field label="Ticker" hint={isOptions ? 'Underlying stock or ETF' : 'Futures contract'}>
                  <Input
                    value={form.symbol ?? ''}
                    placeholder={isOptions ? 'NVDA' : 'MNQ'}
                    onChange={(e) => {
                      const symbol = e.target.value.toUpperCase()
                      const pv = pointValueFor(symbol)
                      set({ symbol, ...(pv && !form.point_value && !isOptions ? { point_value: pv } : {}) })
                    }}
                  />
                </Field>
                <Field label="Direction">
                  <Select value={form.direction} options={DIRECTIONS} onChange={(e) => set({ direction: e.target.value })} />
                </Field>

                <Field label="Trade type" hint="Manage this list in Settings">
                  <Select
                    value={form.setup ?? ''}
                    options={opt('setup')}
                    placeholder="Select"
                    onChange={(e) => set({ setup: e.target.value })}
                  />
                </Field>
                <Field label="Playbook" hint="Decides which rules apply">
                  <Select
                    value={String(form.playbook_id ?? '')}
                    options={reference.playbooks.map((p) => ({ value: String(p.id), label: p.name }))}
                    placeholder="None"
                    onChange={(e) => applyPlaybook(e.target.value)}
                  />
                </Field>
                <Field label="Source">
                  <Select
                    value={form.trade_source ?? ''}
                    options={opt('source')}
                    placeholder="Select"
                    onChange={(e) => set({ trade_source: e.target.value })}
                  />
                </Field>
                <Field label="Status">
                  <Select value={form.status} options={STATUSES} onChange={(e) => set({ status: e.target.value })} />
                </Field>
              </div>
            </Card>

            {/* Timing */}
            <Card>
              <CardHeader title="Timing" />
              <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Entry date">
                  <Input type="date" value={form.trade_date ?? ''} onChange={(e) => set({ trade_date: e.target.value })} />
                </Field>
                <Field label="Exit date" hint="Leave blank for same-day">
                  <Input type="date" value={form.exit_date ?? ''} onChange={(e) => set({ exit_date: e.target.value })} />
                </Field>
                <Field label="Entry time">
                  <Input type="time" value={form.entry_time ?? ''} onChange={(e) => set({ entry_time: e.target.value })} />
                </Field>
                <Field label="Exit time">
                  <Input type="time" value={form.exit_time ?? ''} onChange={(e) => set({ exit_time: e.target.value })} />
                </Field>
                <Field label="Session">
                  <Select value={form.session ?? ''} options={opt('session')} placeholder="Select" onChange={(e) => set({ session: e.target.value })} />
                </Field>
                <Field label="Timeframe">
                  <Select value={form.timeframe ?? ''} options={opt('timeframe')} placeholder="Select" onChange={(e) => set({ timeframe: e.target.value })} />
                </Field>
              </div>
            </Card>

            {/* Position */}
            <Card>
              <CardHeader
                title="Position"
                subtitle={isOptions ? 'Contract details and premium' : 'Entry, exit and structure'}
              />
              {isOptions ? (
                <div className="space-y-4 p-5">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Call or put">
                      <Select value={form.option_type ?? ''} options={['call', 'put']} placeholder="Select" onChange={(e) => set({ option_type: e.target.value })} />
                    </Field>
                    <Field label="Buy or sell" hint="Drives the P&L sign">
                      <Select value={form.option_side ?? ''} options={OPTION_SIDES} placeholder="Select" onChange={(e) => set({ option_side: e.target.value })} />
                    </Field>
                    <Field label="Strike">
                      <Input type="number" step="any" value={form.strike ?? ''} onChange={(e) => set({ strike: e.target.value })} />
                    </Field>
                    <Field label="Expiration">
                      <Input type="date" value={form.expiration ?? ''} onChange={(e) => set({ expiration: e.target.value })} />
                    </Field>
                    <Field label="Contracts">
                      <Input type="number" step="any" value={form.contracts ?? ''} onChange={(e) => set({ contracts: e.target.value })} />
                    </Field>
                    <Field label={form.option_side === 'sell' ? 'Credit received' : 'Premium paid'}>
                      <Input type="number" step="any" value={form.entry_premium ?? ''} onChange={(e) => set({ entry_premium: e.target.value })} />
                    </Field>
                    <Field label="Exit premium" hint="0 if expired worthless">
                      <Input type="number" step="any" value={form.exit_premium ?? ''} onChange={(e) => set({ exit_premium: e.target.value })} />
                    </Field>
                    <Field label="Commissions">
                      <Input type="number" step="any" value={form.commissions ?? ''} onChange={(e) => set({ commissions: e.target.value })} />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Underlying at entry">
                      <Input type="number" step="any" value={form.underlying_entry ?? ''} onChange={(e) => set({ underlying_entry: e.target.value })} />
                    </Field>
                    <Field label="Invalidation level">
                      <Input type="number" step="any" value={form.underlying_stop ?? ''} onChange={(e) => set({ underlying_stop: e.target.value })} />
                    </Field>
                    <Field label="Target level">
                      <Input type="number" step="any" value={form.underlying_target ?? ''} onChange={(e) => set({ underlying_target: e.target.value })} />
                    </Field>
                  </div>

                  <div>
                    <button type="button" className="btn-subtle !px-0" onClick={() => setShowGreeks((v) => !v)}>
                      <ChevronDown size={15} className={`transition ${showGreeks ? 'rotate-180' : ''}`} />
                      Greeks at entry (optional)
                    </button>
                    {showGreeks && (
                      <div className="mt-3 grid gap-4 sm:grid-cols-4">
                        <Field label="Delta">
                          <Input type="number" step="any" value={form.delta ?? ''} onChange={(e) => set({ delta: e.target.value })} />
                        </Field>
                        <Field label="IV %">
                          <Input type="number" step="any" value={form.iv_at_entry ?? ''} onChange={(e) => set({ iv_at_entry: e.target.value })} />
                        </Field>
                        <Field label="Theta">
                          <Input type="number" step="any" value={form.theta ?? ''} onChange={(e) => set({ theta: e.target.value })} />
                        </Field>
                        <Field label="Vega">
                          <Input type="number" step="any" value={form.vega ?? ''} onChange={(e) => set({ vega: e.target.value })} />
                        </Field>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Contracts">
                    <Input type="number" step="any" value={form.contracts ?? ''} onChange={(e) => set({ contracts: e.target.value })} />
                  </Field>
                  <Field label="Point value" hint="Prefilled for known symbols">
                    <Input type="number" step="any" value={form.point_value ?? ''} onChange={(e) => set({ point_value: e.target.value })} />
                  </Field>
                  <Field label="Commissions">
                    <Input type="number" step="any" value={form.commissions ?? ''} onChange={(e) => set({ commissions: e.target.value })} />
                  </Field>
                  <Field label="Entry price">
                    <Input type="number" step="any" value={form.entry_price ?? ''} onChange={(e) => set({ entry_price: e.target.value })} />
                  </Field>
                  <Field label="Exit price">
                    <Input type="number" step="any" value={form.exit_price ?? ''} onChange={(e) => set({ exit_price: e.target.value })} />
                  </Field>
                  <Field label="Stop loss">
                    <Input type="number" step="any" value={form.stop_price ?? ''} onChange={(e) => set({ stop_price: e.target.value })} />
                  </Field>
                  <Field label="Target">
                    <Input type="number" step="any" value={form.target_price ?? ''} onChange={(e) => set({ target_price: e.target.value })} />
                  </Field>
                </div>
              )}
            </Card>

            {/* Result overrides */}
            <Card>
              <CardHeader title="Result" subtitle="Leave blank to use the calculated value above" />
              <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Risk ($)" hint={riskPreview !== null && !form.risk_amount ? `Auto: ${money(riskPreview)}` : undefined}>
                  <Input type="number" step="any" placeholder={riskPreview !== null ? String(riskPreview) : ''} value={form.risk_amount ?? ''} onChange={(e) => set({ risk_amount: e.target.value })} />
                </Field>
                <Field label="Net P&L ($)" hint={netPreview !== null && !form.net_pnl ? `Auto: ${money(netPreview)}` : undefined}>
                  <Input type="number" step="any" placeholder={netPreview !== null ? String(netPreview) : ''} value={form.net_pnl ?? ''} onChange={(e) => set({ net_pnl: e.target.value })} />
                </Field>
                <Field label="R override" hint="Only if you grade R by hand">
                  <Input type="number" step="any" placeholder={rPreview !== null ? rPreview.toFixed(2) : ''} value={form.result_r_override ?? ''} onChange={(e) => set({ result_r_override: e.target.value })} />
                </Field>
                <Field label="Execution grade">
                  <Select value={form.execution_grade ?? ''} options={GRADES} placeholder="Ungraded" onChange={(e) => set({ execution_grade: e.target.value })} />
                </Field>
              </div>
            </Card>

            {/* Review */}
            <Card>
              <CardHeader title="Review" />
              <div className="space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Emotional state">
                    <Select value={form.emotional_state ?? ''} options={opt('emotion')} placeholder="Select" onChange={(e) => set({ emotional_state: e.target.value })} />
                  </Field>
                  <Field label="Mistake tags">
                    <div className="flex flex-wrap gap-1.5">
                      {reference.tags.map((tag) => {
                        const on = (form.tag_ids as number[]).includes(tag.id)
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() =>
                              set({
                                tag_ids: on
                                  ? (form.tag_ids as number[]).filter((t) => t !== tag.id)
                                  : [...(form.tag_ids as number[]), tag.id],
                              })
                            }
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                              on ? 'border-loss/40 bg-loss/10 text-loss' : 'border-line bg-surface-2 text-ink-muted hover:text-ink'
                            }`}
                          >
                            {tag.name}
                          </button>
                        )
                      })}
                    </div>
                  </Field>
                </div>
                <Field label="Notes" hint="What you saw and why you took it">
                  <Textarea rows={4} value={form.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Lesson learned">
                    <Textarea rows={3} value={form.lesson_learned ?? ''} onChange={(e) => set({ lesson_learned: e.target.value })} />
                  </Field>
                  <Field label="Reflections">
                    <Textarea rows={3} value={form.reflections ?? ''} onChange={(e) => set({ reflections: e.target.value })} />
                  </Field>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar: rules + charts */}
          <div className="space-y-5">
            <Card>
              <CardHeader
                title="Rule checklist"
                subtitle={reference.playbooks.find((p) => String(p.id) === String(form.playbook_id))?.name}
                right={
                  <Badge tone={(form.rule_checks as RuleCheck[]).every((c) => c.checked) && form.rule_checks.length ? 'win' : 'neutral'}>
                    {(form.rule_checks as RuleCheck[]).filter((c) => c.checked).length}/{form.rule_checks.length}
                  </Badge>
                }
              />
              <RuleChecklist
                checks={form.rule_checks}
                showViolations={gradingStarted}
                onChange={(rule_checks) => {
                  setGradingStarted(true)
                  set({ rule_checks })
                }}
              />
            </Card>

            <Card>
              <CardHeader title="Chart snapshot" />
              <div className="p-5">
                <ChartUpload images={form.images} onChange={(images) => set({ images })} />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
