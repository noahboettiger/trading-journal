export const money = (v: number | null | undefined, opts: { sign?: boolean; cents?: boolean } = {}) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '--'
  const cents = opts.cents ?? Math.abs(v) < 1000
  const s = Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })
  const prefix = v < 0 ? '-$' : opts.sign ? '+$' : '$'
  return `${prefix}${s}`
}

export const compactMoney = (v: number | null | undefined) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '--'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${sign}$${(abs / 1000).toFixed(1)}k`
  return money(v)
}

export const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? '--' : `${v.toFixed(digits)}%`

export const rMultiple = (v: number | null | undefined) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '--'
  const rounded = Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(Number.isInteger(v) ? 0 : 2)
  return `${v > 0 ? '+' : ''}${rounded}R`
}

export const ratio = (v: number | null | undefined, digits = 2) => {
  if (v === null || v === undefined) return '--'
  if (!Number.isFinite(v)) return '∞'
  return v.toFixed(digits)
}

export const num = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || !Number.isFinite(v) ? '--' : v.toLocaleString('en-US', { maximumFractionDigits: digits })

/** Parse YYYY-MM-DD at local noon so timezone never shifts the calendar day. */
export const parseDay = (iso: string) => new Date(`${String(iso).slice(0, 10)}T12:00:00`)

export const formatDay = (iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions) => {
  if (!iso) return '--'
  return parseDay(iso).toLocaleDateString('en-US', opts ?? { month: 'short', day: 'numeric', year: 'numeric' })
}

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Tailwind text colour for a signed number. */
export const pnlClass = (v: number | null | undefined) =>
  v === null || v === undefined || v === 0 ? 'text-ink-muted' : v > 0 ? 'text-win' : 'text-loss'

export const outcomeClass = (o: string | null | undefined) =>
  o === 'win' ? 'text-win' : o === 'loss' ? 'text-loss' : 'text-ink-muted'
