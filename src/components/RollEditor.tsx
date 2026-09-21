import { Plus, Trash2, ArrowRight } from 'lucide-react'
import { Field, Input } from './ui'
import { money } from '@/lib/format'

export interface Roll {
  id?: number
  rolled_on: string
  close_cost: string | number | null
  new_strike: string | number | null
  new_expiration: string
  new_contracts: string | number | null
  new_credit: string | number | null
  note?: string | null
  sort_order?: number
}

const n = (v: unknown) => {
  if (v === '' || v === null || v === undefined) return null
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * A roll closes the contract in hand and opens another. Recording it here keeps
 * one position as one trade: the credit banked on earlier legs is not lost, the
 * holding period stays the whole campaign, and the trade count is not inflated
 * by what is really trade management.
 */
export function RollEditor({
  rolls,
  onChange,
  openingStrike,
  openingContracts,
  openingExpiration,
}: {
  rolls: Roll[]
  onChange: (next: Roll[]) => void
  openingStrike: string | number | null
  openingContracts: string | number | null
  openingExpiration: string
}) {
  const update = (i: number, patch: Partial<Roll>) =>
    onChange(rolls.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const add = () => {
    const previous = rolls[rolls.length - 1]
    onChange([
      ...rolls,
      {
        rolled_on: '',
        close_cost: '',
        // A roll usually keeps the size and moves the date, so carry those over.
        new_strike: previous ? previous.new_strike : openingStrike,
        new_expiration: '',
        new_contracts: previous ? previous.new_contracts : openingContracts,
        new_credit: '',
        sort_order: rolls.length,
      },
    ])
  }

  return (
    <div className="space-y-3">
      {rolls.length === 0 && (
        <p className="text-xs text-ink-faint">
          No rolls yet. Add one when you buy back the contract in hand and sell another in its place.
        </p>
      )}

      {rolls.map((roll, i) => {
        const fromStrike = i === 0 ? openingStrike : rolls[i - 1].new_strike
        const fromExpiration = i === 0 ? openingExpiration : rolls[i - 1].new_expiration
        const cost = n(roll.close_cost)
        const contracts = i === 0 ? n(openingContracts) : n(rolls[i - 1].new_contracts)
        const paid = cost !== null && contracts !== null ? cost * 100 * contracts : null

        return (
          <div key={roll.id ?? `new-${i}`} className="rounded-lg border border-line bg-surface-2/40 p-3">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-muted">
                Roll {i + 1}
                <span className="chip !py-0.5 !text-[11px]">
                  {fromStrike || '?'}P {fromExpiration ? `exp ${fromExpiration}` : ''}
                </span>
                <ArrowRight size={13} className="text-ink-faint" />
                <span className="chip !py-0.5 !text-[11px]">
                  {roll.new_strike || '?'}P {roll.new_expiration ? `exp ${roll.new_expiration}` : ''}
                </span>
                {paid !== null && (
                  <span className="text-[11px] font-normal text-ink-faint">paid {money(paid)} to close</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onChange(rolls.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, sort_order: idx })))}
                aria-label={`Remove roll ${i + 1}`}
                className="shrink-0 rounded p-1.5 text-ink-faint transition hover:bg-loss/15 hover:text-loss"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Rolled on">
                <Input type="date" value={roll.rolled_on ?? ''} onChange={(e) => update(i, { rolled_on: e.target.value })} />
              </Field>
              <Field label="Paid to close" hint="Premium per contract">
                <Input type="number" step="any" value={roll.close_cost ?? ''} onChange={(e) => update(i, { close_cost: e.target.value })} />
              </Field>
              <Field label="New strike">
                <Input type="number" step="any" value={roll.new_strike ?? ''} onChange={(e) => update(i, { new_strike: e.target.value })} />
              </Field>
              <Field label="New expiration">
                <Input type="date" value={roll.new_expiration ?? ''} onChange={(e) => update(i, { new_expiration: e.target.value })} />
              </Field>
              <Field label="New credit" hint="Premium per contract">
                <Input type="number" step="any" value={roll.new_credit ?? ''} onChange={(e) => update(i, { new_credit: e.target.value })} />
              </Field>
            </div>

            <Field label="Contracts on the new leg" className="mt-3 max-w-[180px]">
              <Input type="number" step="any" value={roll.new_contracts ?? ''} onChange={(e) => update(i, { new_contracts: e.target.value })} />
            </Field>
          </div>
        )
      })}

      <button type="button" className="btn-ghost w-full" onClick={add}>
        <Plus size={15} /> {rolls.length ? 'Add another roll' : 'Record a roll'}
      </button>
    </div>
  )
}
