/**
 * Pick any number of values from a short list. Used where a single dropdown
 * would force a false choice, such as feeling both impatient and frustrated on
 * the same trade.
 */
export function ChipMultiSelect({
  options,
  selected,
  onChange,
  tone = 'accent',
  emptyText = 'Nothing to choose from yet.',
}: {
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  tone?: 'accent' | 'loss'
  emptyText?: string
}) {
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])

  const onClass =
    tone === 'loss'
      ? 'border-loss/40 bg-loss/10 text-loss'
      : 'border-accent/45 bg-accent/10 text-accent'

  if (!options.length) return <p className="text-xs text-ink-faint">{emptyText}</p>

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = selected.includes(option)
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(option)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              on ? onClass : 'border-line bg-surface-2 text-ink-muted hover:text-ink'
            }`}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
