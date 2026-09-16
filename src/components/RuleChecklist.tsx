import { useMemo } from 'react'
import { Check, TriangleAlert } from 'lucide-react'
import type { RuleCheck } from '@/lib/types'
import { Badge } from './ui'

/**
 * The itemized rule checklist that replaces a yes/no "rules followed" flag.
 * Each row carries its own snapshot of the rule text, so a trade stays graded
 * against the rules as they read on the day it was taken.
 */
export function RuleChecklist({
  checks,
  onChange,
  readOnly = false,
  showViolations = readOnly,
  columns = false,
}: {
  checks: RuleCheck[]
  onChange?: (next: RuleCheck[]) => void
  readOnly?: boolean
  /** Lay the sections out side by side, for a full-width card. */
  columns?: boolean
  /**
   * Whether an unchecked rule counts as broken yet. A brand new trade has not
   * been graded, so nothing should read as a violation until the trader has
   * started working through the list.
   */
  showViolations?: boolean
}) {
  const sections = useMemo(() => {
    const map = new Map<string, { check: RuleCheck; index: number }[]>()
    checks.forEach((check, index) => {
      if (!map.has(check.section)) map.set(check.section, [])
      map.get(check.section)!.push({ check, index })
    })
    return [...map.entries()]
  }, [checks])

  const toggle = (index: number) => {
    if (readOnly || !onChange) return
    onChange(checks.map((c, i) => (i === index ? { ...c, checked: !c.checked } : c)))
  }

  const setNote = (index: number, note: string) => {
    if (readOnly || !onChange) return
    onChange(checks.map((c, i) => (i === index ? { ...c, note } : c)))
  }

  if (!checks.length) {
    return <p className="px-5 py-8 text-center text-sm text-ink-faint">No rules attached to this trade.</p>
  }

  return (
    <div
      className={
        columns
          ? 'grid gap-x-6 px-2 py-2 md:grid-cols-2 xl:grid-cols-3'
          : 'divide-y divide-line'
      }
    >
      {sections.map(([section, rows]) => {
        const done = rows.filter((r) => r.check.checked).length
        return (
          <div
            key={section}
            className={columns ? 'px-3 py-3' : 'border-b border-line px-4 py-3.5 last:border-0 lg:px-5'}
          >
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <h3 className="label">{section}</h3>
              <span className={`text-[11px] font-semibold tnum ${done === rows.length ? 'text-win' : 'text-ink-faint'}`}>
                {done}/{rows.length}
              </span>
            </div>

            <ul className="space-y-1">
              {rows.map(({ check, index }) => {
                const missedCritical = showViolations && check.is_critical && !check.checked
                return (
                  <li key={index}>
                    <div
                      className={`group flex items-start gap-3 rounded-lg px-2 py-2 transition ${
                        readOnly ? '' : 'cursor-pointer hover:bg-surface-2'
                      } ${missedCritical ? 'bg-loss/5' : ''}`}
                      onClick={() => toggle(index)}
                      role={readOnly ? undefined : 'checkbox'}
                      aria-checked={check.checked}
                      tabIndex={readOnly ? undefined : 0}
                      onKeyDown={(e) => {
                        if (!readOnly && (e.key === ' ' || e.key === 'Enter')) {
                          e.preventDefault()
                          toggle(index)
                        }
                      }}
                    >
                      <span
                        className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded border transition ${
                          check.checked
                            ? 'border-accent bg-accent text-surface-0'
                            : missedCritical
                              ? 'border-loss/50 bg-transparent'
                              : 'border-line bg-surface-2'
                        }`}
                      >
                        {check.checked && <Check size={13} strokeWidth={3.5} />}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className={`text-sm leading-snug ${check.checked ? 'text-ink' : 'text-ink-muted'}`}>
                          {check.rule_text}
                          {check.is_critical && (
                            <span className="ml-1.5 align-middle text-[10px] font-bold text-ink-faint" title="Critical rule">
                              ●
                            </span>
                          )}
                        </p>
                        {missedCritical && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-loss">
                            <TriangleAlert size={11} /> Critical rule broken
                          </span>
                        )}
                      </div>
                    </div>

                    {!check.checked && showViolations && (
                      readOnly ? (
                        check.note && <p className="ml-[38px] mt-0.5 text-xs italic text-ink-faint">{check.note}</p>
                      ) : (
                        <input
                          value={check.note ?? ''}
                          onChange={(e) => setNote(index, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Why was this missed?"
                          className="ml-[38px] mt-1 w-[calc(100%-38px)] rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-faint outline-none focus:border-accent/60"
                        />
                      )
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Compact compliance summary. `compact` drops the wording for table rows, where
 * the column header already says "Rules" and a wrapping badge makes every row
 * three lines tall.
 */
export function ComplianceBadge({ checks, compact = false }: { checks: RuleCheck[]; compact?: boolean }) {
  if (!checks.length) {
    return <span className="whitespace-nowrap text-xs text-ink-faint">{compact ? '--' : 'Not graded'}</span>
  }
  const checked = checks.filter((c) => c.checked).length
  const criticalMissed = checks.filter((c) => c.is_critical && !c.checked).length
  const clean = checked === checks.length
  return (
    <Badge tone={clean ? 'win' : criticalMissed ? 'loss' : 'warn'}>
      {checked}/{checks.length}
      {!compact && ' rules'}
      {criticalMissed > 0 && (compact ? ` (${criticalMissed}!)` : ` · ${criticalMissed} critical`)}
    </Badge>
  )
}
