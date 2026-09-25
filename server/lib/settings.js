import { db } from './db.js'
import { num } from '../../shared/calc.js'

/**
 * Small key/value settings, stored in app_meta.
 *
 * Only these keys are readable or writable, so a stray request cannot reach the
 * internal markers that share the table.
 */
export const SETTING_DEFAULTS = {
  risk_cap_funded: 250,
  risk_cap_eval: 500,
  account_type_default: 'funded',
}

const NUMERIC = new Set(['risk_cap_funded', 'risk_cap_eval'])

export function readSettings() {
  const out = { ...SETTING_DEFAULTS }
  const keys = Object.keys(SETTING_DEFAULTS)
  const rows = db
    .prepare(`SELECT key, value FROM app_meta WHERE key IN (${keys.map(() => '?').join(', ')})`)
    .all(...keys)
  for (const { key, value } of rows) {
    if (value === null || value === '') continue
    out[key] = NUMERIC.has(key) ? (num(value) ?? SETTING_DEFAULTS[key]) : value
  }
  return out
}

export function writeSettings(patch) {
  const stmt = db.prepare(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
  )
  for (const [key, raw] of Object.entries(patch)) {
    if (!(key in SETTING_DEFAULTS)) continue
    if (NUMERIC.has(key)) {
      const value = num(raw)
      if (value === null || value <= 0) continue
      stmt.run(key, String(value))
    } else {
      if (!raw) continue
      stmt.run(key, String(raw))
    }
  }
  return readSettings()
}

/**
 * The dollar cap a trade in this account phase is graded against.
 *
 * Evals get a bigger number on purpose: the point is to pass one and move on,
 * not to nurse it for months. Returns null when no phase is set, so a trade
 * without one is never graded against a figure nobody chose.
 */
export function riskCapFor(accountType) {
  const settings = readSettings()
  if (accountType === 'eval') return settings.risk_cap_eval
  if (accountType === 'funded') return settings.risk_cap_funded
  return null
}
