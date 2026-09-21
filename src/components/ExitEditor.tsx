import { Plus, Trash2 } from 'lucide-react'
import { Field, Input } from './ui'
import { money } from '@/lib/format'

export interface Exit {
  id?: number
  exited_on: string
  contracts: string | number | null
  price: string | number | null
  note?: string | null
  sort_order?: number
}

const n = (v: unknown) => {
  if (v === '' || v === null || v === undefined) return null
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Scaling out, one row per fill.
 *
 * Taking one contract off a three-lot is one position with two exits. Averaging
 * the prices by hand would lose the dates and the sizes, and each fill carries
 * its own share of what the position cost to open.
 */
export function ExitEditor({
  exits,
  onChange,
  openedContracts,
  isSelling,
}: {
  exits: Exit[]
  onChange: (next: Exit[]) => void
  openedContracts: number | null
  isSelling: boolean
}) {
  const update = (i: number, patch: Partial<Exit>) =>
    onChange(exits.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))

  const takenOff = exits.reduce((a, e) => a + (n(e.contracts) ?? 0), 0)
  const remaining = openedContracts === null ? null : openedContracts - takenOff

  const add = () =>
    onChange([
      ...exits,
      {
        exited_on: '',
        // Default to whatever is left, which is the common case for a last fill.
        contracts: remaining && remaining > 0 ? remaining : '',
        price: '',
        sort_order: exits.length,
      },
    ])

  return (
    <div className="space-y-3">
      {exits.length === 0 && (
        <p className="text-xs text-ink-faint">
          No partial exits recorded. Add one for each fill that took size off.
        </p>
      )}

      {exits.map((exit, i) => {
        const contracts = n(exit.contracts)
        const price = n(exit.price)
        const cash = contracts !== null && price !== null ? price * 100 * contracts : null
        return (
          <div key={exit.id ?? `new-${i}`} className="rounded-lg border border-line bg-surface-2/40 p-3">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-muted">
                Exit {i + 1}
                {contracts !== null && (
                  <span className="chip !py-0.5 !text-[11px]">
                    {contracts} contract{contracts === 1 ? '' : 's'}
                  </span>
                )}
                {cash !== null && (
                  <span className={`text-[11px] font-semibold ${isSelling ? 'text-loss' : 'text-win'}`}>
                    {isSelling ? `${money(cash)} to buy back` : `${money(cash)} proceeds`}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onChange(exits.filter((_, idx) => idx !== i).map((e, idx) => ({ ...e, sort_order: idx })))}
                aria-label={`Remove exit ${i + 1}`}
                className="shrink-0 rounded p-1.5 text-ink-faint transition hover:bg-loss/15 hover:text-loss"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Date">
                <Input type="date" value={exit.exited_on ?? ''} onChange={(e) => update(i, { exited_on: e.target.value })} />
              </Field>
              <Field label="Contracts">
                <Input type="number" step="any" value={exit.contracts ?? ''} onChange={(e) => update(i, { contracts: e.target.value })} />
              </Field>
              <Field label={isSelling ? 'Buy-back premium' : 'Exit premium'} hint="Per contract">
                <Input type="number" step="any" value={exit.price ?? ''} onChange={(e) => update(i, { price: e.target.value })} />
              </Field>
            </div>
          </div>
        )
      })}

      {remaining !== null && exits.length > 0 && (
        <p className={`text-[11px] ${remaining > 0 ? 'text-ink-faint' : 'text-win'}`}>
          {remaining > 0
            ? `${remaining} of ${openedContracts} contract${openedContracts === 1 ? '' : 's'} still open. The position stays open and out of realised P&L until every contract is out.`
            : remaining === 0
              ? 'Every contract is out, so this position is fully closed.'
              : `That is ${Math.abs(remaining)} more than the ${openedContracts} opened.`}
        </p>
      )}

      <button type="button" className="btn-ghost w-full" onClick={add}>
        <Plus size={15} /> {exits.length ? 'Add another exit' : 'Record a partial exit'}
      </button>
    </div>
  )
}
