import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, LineChart } from 'lucide-react'
import { useJournal } from '@/lib/journals'
import { compactMoney, pnlClass } from '@/lib/format'

/**
 * Switches which book you are looking at. Everything downstream (trades,
 * dashboard, calendar, analytics, day notes) is scoped to the selection.
 */
export function JournalSwitcher({ compact = false }: { compact?: boolean }) {
  const { journals, journal, setJournalId, loading } = useJournal()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading || journals.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-surface-2 disabled:opacity-60"
      >
        <span className={`grid shrink-0 place-items-center rounded-lg bg-accent text-surface-0 ${compact ? 'h-7 w-7' : 'h-8 w-8'}`}>
          <LineChart size={compact ? 15 : 17} strokeWidth={2.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold tracking-tight" title={journal?.name}>
            {journal?.name ?? 'Trading Journal'}
          </span>
          {!compact && journal && (
            <span className="block truncate text-[11px] text-ink-faint">
              {journal.trade_count} trade{journal.trade_count === 1 ? '' : 's'}
            </span>
          )}
        </span>
        <ChevronDown size={15} className={`shrink-0 text-ink-faint transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-xl2 border border-line bg-surface-1 shadow-xl shadow-black/30"
        >
          {journals.map((j) => (
            <button
              key={j.id}
              role="option"
              aria-selected={j.id === journal?.id}
              onClick={() => {
                setJournalId(j.id)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-surface-2"
            >
              <Check size={14} className={j.id === journal?.id ? 'text-accent' : 'text-transparent'} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{j.name}</span>
                <span className="block text-[11px] text-ink-faint">
                  {j.trade_count} trade{j.trade_count === 1 ? '' : 's'}
                </span>
              </span>
              <span className={`shrink-0 text-xs font-semibold tnum ${pnlClass(j.net_pnl)}`}>
                {j.trade_count ? compactMoney(j.net_pnl) : '--'}
              </span>
            </button>
          ))}
          <div className="border-t border-line px-3 py-2 text-[11px] text-ink-faint">
            Each journal keeps its own trades and stats. Manage them in Settings.
          </div>
        </div>
      )}
    </div>
  )
}
