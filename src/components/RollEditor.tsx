import { useState } from 'react'
import { Plus, Trash2, ArrowRight } from 'lucide-react'
import { Field, Input, Segmented } from './ui'
import { money } from '@/lib/format'

export interface Roll {
  id?: number
  rolled_on: string
  /** Net price of the whole roll, as a combo order fills. Credit positive. */
  net_credit: string | number | null
  close_cost: string | number | null
  new_strike: string | number | null
  new_expiration: string
  new_contracts: string | number | null
  new_credit: string | number | null
  note?: string | null
  sort_order?: number
}

type Mode = 'net' | 'legs'

/**
 * Which way a saved roll was entered. Only used to pick the initial mode: once
 * the editor is open the choice is held in state, because inferring it from the
 * values makes the toggle impossible to use before anything has been typed.
 */
const inferMode = (roll: Roll): Mode =>
  roll.close_cost !== null && roll.close_cost !== undefined && roll.close_cost !== '' ? 'legs' : 'net'

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
  const [modes, setModes] = useState<Record<number, Mode>>({})
  const modeOf = (i: number): Mode => modes[i] ?? inferMode(rolls[i])
  const setMode = (i: number, mode: Mode) => {
    setModes((prev) => ({ ...prev, [i]: mode }))
    // Clear the other shape so only one set of numbers is ever in play.
    update(i, mode === 'net' ? { close_cost: '', new_credit: '' } : { net_credit: '' })
  }

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
        // Most rolls fill as one combo ticket, so start on the net price.
        net_credit: '',
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
        const contracts = n(roll.new_contracts) ?? (i === 0 ? n(openingContracts) : n(rolls[i - 1].new_contracts))
        const netMode = modeOf(i) === 'net'
        const net = netMode
          ? n(roll.net_credit)
          : n(roll.new_credit) === null && n(roll.close_cost) === null
            ? null
            : (n(roll.new_credit) ?? 0) - (n(roll.close_cost) ?? 0)
        const cash = net !== null && contracts !== null ? net * 100 * contracts : null

        return (
          <div key={roll.id ?? `new-${i}`} className="rounded-lg border border-line bg-surface-2/40 p-3">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-muted">
                Roll {i + 1}
                <span className="chip !py-0.5 !text-[11px]">
                  {fromStrike || '?'}P {fromExpiration ? `exp ${fromExpiration}` : ''}
                </span>
                <ArrowRight size={13} className="text-ink-faint" />
                <span className="chip !py-0.5 !text-[11px]">
                  {roll.new_strike || '?'}P {roll.new_expiration ? `exp ${roll.new_expiration}` : ''}
                </span>
                {cash !== null && (
                  <span className={`text-[11px] font-semibold ${cash >= 0 ? 'text-win' : 'text-loss'}`}>
                    {cash >= 0 ? `${money(cash)} credit` : `${money(Math.abs(cash))} debit`}
                  </span>
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

            <div className="mb-3">
              <Segmented
                value={netMode ? 'net' : 'legs'}
                onChange={(mode) => setMode(i, mode as Mode)}
                options={[
                  { value: 'net', label: 'One net price' },
                  { value: 'legs', label: 'Two separate fills' },
                ]}
              />
              <p className="mt-1.5 text-[11px] text-ink-faint">
                {netMode
                  ? 'A diagonal or calendar roll fills as one order. Enter the net price from the ticket, positive for a credit and negative for a debit.'
                  : 'Use this when you closed and reopened as two separate orders with their own prices.'}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Rolled on">
                <Input type="date" value={roll.rolled_on ?? ''} onChange={(e) => update(i, { rolled_on: e.target.value })} />
              </Field>

              {netMode ? (
                <Field label="Net price" hint="Credit positive, debit negative">
                  <Input
                    type="number"
                    step="any"
                    value={roll.net_credit ?? ''}
                    onChange={(e) => update(i, { net_credit: e.target.value })}
                  />
                </Field>
              ) : (
                <>
                  <Field label="Paid to close" hint="Premium per contract">
                    <Input type="number" step="any" value={roll.close_cost ?? ''} onChange={(e) => update(i, { close_cost: e.target.value })} />
                  </Field>
                  <Field label="New credit" hint="Premium per contract">
                    <Input type="number" step="any" value={roll.new_credit ?? ''} onChange={(e) => update(i, { new_credit: e.target.value })} />
                  </Field>
                </>
              )}

              <Field label="New strike">
                <Input type="number" step="any" value={roll.new_strike ?? ''} onChange={(e) => update(i, { new_strike: e.target.value })} />
              </Field>
              <Field label="New expiration">
                <Input type="date" value={roll.new_expiration ?? ''} onChange={(e) => update(i, { new_expiration: e.target.value })} />
              </Field>
              <Field label="Contracts">
                <Input type="number" step="any" value={roll.new_contracts ?? ''} onChange={(e) => update(i, { new_contracts: e.target.value })} />
              </Field>
            </div>
          </div>
        )
      })}

      <button type="button" className="btn-ghost w-full" onClick={add}>
        <Plus size={15} /> {rolls.length ? 'Add another roll' : 'Record a roll'}
      </button>
    </div>
  )
}
