/**
 * Dollar value of a one-point move, per contract. Used to prefill the point
 * value field when a known symbol is typed. Always editable on the form.
 */
export const POINT_VALUES: Record<string, number> = {
  ES: 50, MES: 5,
  NQ: 20, MNQ: 2,
  YM: 5, MYM: 0.5,
  RTY: 50, M2K: 5,
  GC: 100, MGC: 10,
  SI: 5000, SIL: 1000,
  CL: 1000, MCL: 100,
  NG: 10000, QG: 2500,
  ZB: 1000, ZN: 1000, ZF: 1000, ZT: 2000,
  '6E': 125000, '6J': 12500000, '6B': 62500,
  HG: 25000, PL: 50, ZC: 50, ZS: 50, ZW: 50,
  BTC: 5, MBT: 0.1, ETH: 50, MET: 0.1,
}

export const pointValueFor = (symbol: string | null | undefined): number | null => {
  if (!symbol) return null
  const key = symbol.trim().toUpperCase().replace(/[!#].*$/, '').replace(/\d+$/, '')
  return POINT_VALUES[key] ?? POINT_VALUES[symbol.trim().toUpperCase()] ?? null
}

export const GRADES = ['A', 'B', 'C', 'D', 'F']
export const ASSET_CLASSES = [
  { value: 'futures', label: 'Futures' },
  { value: 'options', label: 'Options' },
]
export const DIRECTIONS = [
  { value: 'long', label: 'Long / Bullish' },
  { value: 'short', label: 'Short / Bearish' },
]
export const OPTION_SIDES = [
  { value: 'buy', label: 'Buying premium' },
  { value: 'sell', label: 'Selling premium' },
]
export const STATUSES = [
  { value: 'closed', label: 'Closed' },
  { value: 'open', label: 'Open' },
  { value: 'planned', label: 'Planned' },
]

export const CLOSE_METHODS = [
  { value: 'bought_to_close', label: 'Bought to close' },
  { value: 'expired', label: 'Expired worthless' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'rolled', label: 'Rolled' },
  { value: 'sold_to_close', label: 'Sold to close' },
]

export const CLOSE_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  CLOSE_METHODS.map((m) => [m.value, m.label]),
)
