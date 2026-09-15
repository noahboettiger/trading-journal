import { type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { pnlClass } from '@/lib/format'

export function Card({ children, className = '', ...rest }: { children: ReactNode; className?: string } & Record<string, any>) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ title, icon, right, subtitle }: { title: ReactNode; icon?: ReactNode; right?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-5 py-4">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-muted">{icon}</span>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold truncate">{title}</h2>
          {subtitle && <p className="text-xs text-ink-faint truncate">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="shrink-0 max-w-full overflow-x-auto">{right}</div>}
    </div>
  )
}

export function Field({ label, hint, children, className = '' }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    // The hint sits outside the <label> on purpose: inside it, it becomes part
    // of the input's accessible name, so a screen reader would announce
    // "Collateral Strike x 100 x contracts" instead of just "Collateral".
    <div className={className}>
      <label className="block">
        <span className="label mb-1.5 block">{label}</span>
        {children}
      </label>
      {hint && <span className="mt-1 block text-[11px] text-ink-faint">{hint}</span>}
    </div>
  )
}

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`input ${props.className ?? ''}`} />
)

export const Textarea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={`input ${props.className ?? ''}`} />
)

export function Select({ options, placeholder, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & {
  options: (string | { value: string; label: string })[]
  placeholder?: string
}) {
  return (
    <select {...rest} className={`input ${rest.className ?? ''}`}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const value = typeof o === 'string' ? o : o.value
        const label = typeof o === 'string' ? o : o.label
        return (
          <option key={value} value={value}>
            {label}
          </option>
        )
      })}
    </select>
  )
}

/** Headline number tile used across the dashboard. */
export function Stat({ label, value, sub, tone = 'neutral', icon }: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'neutral' | 'pnl' | 'good' | 'bad'
  icon?: ReactNode
}) {
  const toneClass =
    tone === 'good' ? 'text-win' : tone === 'bad' ? 'text-loss' : 'text-ink'
  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="label">{label}</span>
        {icon && <span className="text-ink-faint">{icon}</span>}
      </div>
      <div className={`mt-1.5 text-[22px] font-semibold leading-tight tnum ${toneClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-faint tnum">{sub}</div>}
    </div>
  )
}

export function PnlStat({ label, value, sub, icon }: { label: string; value: number | null; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="label">{label}</span>
        {icon && <span className="text-ink-faint">{icon}</span>}
      </div>
      <div className={`mt-1.5 text-[22px] font-semibold leading-tight tnum ${pnlClass(value)}`}>
        {value === null || !Number.isFinite(value as number)
          ? '--'
          : `${value > 0 ? '+' : value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('en-US', {
              minimumFractionDigits: Math.abs(value) < 1000 ? 2 : 0,
              maximumFractionDigits: Math.abs(value) < 1000 ? 2 : 0,
            })}`}
      </div>
      {sub && <div className="mt-0.5 text-xs text-ink-faint tnum">{sub}</div>}
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'win' | 'loss' | 'warn' | 'accent' }) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-muted border-line',
    win: 'bg-win/10 text-win border-win/25',
    loss: 'bg-loss/10 text-loss border-loss/25',
    warn: 'bg-amber-500/10 text-amber-500 border-amber-500/25',
    accent: 'bg-accent/10 text-accent border-accent/25',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-[6px] px-3 py-1.5 text-xs font-medium transition ${
            value === o.value ? 'bg-accent text-surface-0' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && <div className="text-ink-faint">{icon}</div>}
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {body && <p className="mt-1 max-w-sm text-sm text-ink-faint">{body}</p>}
      </div>
      {action}
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-faint">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <div className="rounded-lg border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss">
      {error instanceof Error ? error.message : String(error)}
    </div>
  )
}
