export type AssetClass = 'futures' | 'options'
export type Direction = 'long' | 'short'
export type Outcome = 'win' | 'loss' | 'breakeven' | null
export type TradeStatus = 'planned' | 'open' | 'closed'

export interface RuleCheck {
  id?: number
  rule_id: number | null
  section: string
  rule_text: string
  is_critical: boolean
  checked: boolean
  note: string | null
  sort_order: number
}

export interface Rule {
  id?: number
  playbook_id?: number
  section: string
  text: string
  detail: string | null
  is_critical: boolean
  is_active: boolean
  sort_order: number
}

export interface Playbook {
  id: number
  name: string
  asset_class: AssetClass
  description: string | null
  is_active: boolean
  sort_order: number
  rules: Rule[]
}

export type LookupKind = 'setup' | 'style' | 'session' | 'source' | 'emotion' | 'timeframe'

export interface Lookup {
  id: number
  kind: LookupKind
  value: string
  asset_class: AssetClass | null
  sort_order: number
  is_active: boolean
}

export type Lookups = Partial<Record<LookupKind, Lookup[]>>

export interface Tag { id: number; name: string; kind: string }
export interface TradeImage { id?: number; path: string; caption: string | null; sort_order: number }

export interface Trade {
  id: number
  trade_no: number
  playbook_id: number | null
  playbook_name: string | null

  asset_class: AssetClass
  trade_style: string
  symbol: string
  direction: Direction
  status: TradeStatus
  outcome: Outcome

  trade_date: string
  exit_date: string | null
  entry_time: string | null
  exit_time: string | null
  session: string | null
  timeframe: string | null
  setup: string | null
  trade_source: string | null

  contracts: number | null
  entry_price: number | null
  exit_price: number | null
  stop_price: number | null
  target_price: number | null
  point_value: number | null

  option_type: 'call' | 'put' | null
  option_side: 'buy' | 'sell' | null
  close_method: string | null
  collateral: number | null
  strike: number | null
  expiration: string | null
  entry_premium: number | null
  exit_premium: number | null
  underlying_entry: number | null
  underlying_stop: number | null
  underlying_target: number | null
  dte_at_entry: number | null
  delta: number | null
  theta: number | null
  vega: number | null
  iv_at_entry: number | null

  risk_amount: number | null
  planned_rr: number | null
  gross_pnl: number | null
  commissions: number
  net_pnl: number | null
  result_r_override: number | null
  result_r: number | null
  computed_rr: number | null
  days_held: number | null
  dte_entry: number | null
  dte_exit: number | null
  return_on_risk: number | null
  collateral_required: number | null
  credit_received: number | null
  return_on_collateral: number | null
  annualised_return: number | null
  pct_of_max_profit: number | null

  execution_grade: string | null
  emotional_state: string | null
  thesis: string | null
  notes: string | null
  lesson_learned: string | null
  reflections: string | null

  rule_checks: RuleCheck[]
  tags: Tag[]
  images: TradeImage[]
  created_at: string
  updated_at: string
}

export interface Summary {
  trades: number; wins: number; losses: number; breakevens: number
  winRate: number | null; netPnl: number; grossWin: number; grossLoss: number
  profitFactor: number | null; avgWin: number | null; avgLoss: number | null
  avgTrade: number | null; expectancy: number | null; avgR: number | null; totalR: number | null
  bestTrade: number | null; worstTrade: number | null
  currentStreak: number; longestWinStreak: number; longestLossStreak: number
  maxDrawdown: number
}

export interface PeriodRollup {
  pnl: number; trades: number; wins: number; losses: number; r: number; winRate: number | null
}
export type WeekRollup = PeriodRollup & { week: string; weekStart: string }
export type MonthRollup = PeriodRollup & { month: string }

export interface DayRollup {
  date: string; pnl: number; trades: number; wins: number; losses: number
  r: number; winRate: number | null
}

export interface RulePerf {
  rule_text: string; section: string; is_critical: boolean
  timesApplied: number; timesBroken: number; breakRate: number | null
  followedPnl: number; brokenPnl: number
  followedWinRate: number | null; brokenWinRate: number | null
  followedAvgR: number | null; brokenAvgR: number | null
}

export interface Stats {
  summary: Summary
  daily: DayRollup[]
  weekly: WeekRollup[]
  monthly: MonthRollup[]
  equityCurve: { tradeNo: number; date: string; pnl: number; equity: number; drawdown: number }[]
  compliance: {
    graded: number; ungraded: number
    compliant: Summary & { count: number }
    nonCompliant: Summary & { count: number }
  }
  rulePerformance: RulePerf[]
  bySetup: Bucket[]; byStyle: Bucket[]; byAssetClass: Bucket[]; byOptionSide: Bucket[]
  bySource: Bucket[]; bySession: Bucket[]; bySymbol: Bucket[]; byDirection: Bucket[]
  byTimeframe: Bucket[]; byPlaybook: Bucket[]; byGrade: Bucket[]; byEmotion: Bucket[]
  byDayOfWeek: Bucket[]; byMistake: Bucket[]
}

/** A grouped performance row. The first key names the bucket (setup, session, ...). */
export type Bucket = Summary & Record<string, any>
