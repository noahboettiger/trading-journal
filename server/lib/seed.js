import { db } from './db.js'

/**
 * First-run defaults only. Everything here is editable in Settings, and this
 * never overwrites existing rows - it runs only when a table is empty.
 */

const FUTURES_RULES = [
  ['Operational Readiness', 'Awake by 5:30 AM and at desk by 6:00 AM', 'Physical readiness gate. Unchecked means you were rushed before the window opened.', 0],
  ['Operational Readiness', 'No premarket FOMO - waited for the window to start', 'No positions taken before your defined session window.', 0],

  ['Model Compliance', 'HTF liquidity sweep or retracement to a 15m fair value gap present', 'Either a high time frame sweep of liquidity, or price retracing into a 15m FVG.', 1],
  ['Model Compliance', 'Clear, defined HTF draw on liquidity identified', 'You could name the specific level price was drawing toward before you entered.', 1],
  ['Model Compliance', 'Trade taken in the direction of the defined HTF draw on liquidity', 'No countertrend entries against your own identified draw.', 1],
  ['Model Compliance', 'Entry trigger: 1m-5m IFVG closure with CSD confirmed', 'Inverse fair value gap closure on the 1, 2, 3, 4 or 5 minute chart, with change in state of delivery confirmation.', 1],

  ['Risk Management', 'Risk strictly locked at {risk_cap} maximum', 'Hard dollar cap per trade. The figure follows the account type: evals get the bigger number, funded accounts the smaller one.', 1],
  ['Risk Management', 'Target meets minimum 1.5:1 risk to reward', 'Planned target had to pay at least 1.5R before you took the entry.', 1],
  ['Risk Management', 'Stop loss placed at the swing low/high', 'Stop sits behind real structure, not at an arbitrary dollar distance.', 1],
]

const OPTIONS_RULES = [
  ['Setup Quality', 'A+ setup only', 'If it is not A+, it is not a trade. Everything else is a pass.', 1],
  ['Setup Quality', 'Catalyst or news checked before entry', 'You know what is scheduled between now and your exit.', 0],
  ['Risk Management', 'Not over-leveraged for this setup', 'Size reflects conviction and what is going on around it, not the maximum the account allows.', 1],
  ['Risk Management', 'Comfortable losing the full premium', 'For long premium, a total loss would not change how you trade tomorrow.', 1],
  ['Exit', 'Exit plan defined before entry', 'You know what takes you out, in profit and in loss.', 0],
]

const CSP_RULES = [
  ['Assignment', 'Genuinely happy to own the shares at this strike', 'The whole trade rests on this. If assignment would be a problem, the strike is wrong.', 1],
  ['Assignment', 'Collateral actually available and set aside', 'Strike x 100 x contracts is really sitting there, uncommitted.', 1],
  ['Setup Quality', 'A+ setup only', 'Same bar as the swing book. Premium alone is not a reason.', 1],
  ['Setup Quality', 'Earnings and catalysts checked through expiration', 'You know what is scheduled before this expires.', 0],
  ['Exit', 'Buy-back target set (50-60% of max profit)', 'The level where you take it off rather than holding for the last few cents.', 0],
  ['Risk Management', 'Not over-leveraged across all open short puts', 'Total collateral committed across every open put is still comfortable.', 1],
]

/** Editable dropdown lists. Add to any of these from Settings. */
const LOOKUPS = {
  setup: [
    'Freestyle', 'iFVG Reversal', 'Mech Model', 'Break and Retest', '2022 Model', 'Unicorn Model',
  ],
  style: ['Day Trade', 'Swing Trade', 'Cash-Secured Put', 'Scalp', 'Position'],
  session: ['Asia', 'London', 'NY AM', 'NY PM', 'Overnight'],
  source: ['Prop', 'Personal', 'Eval', 'Live'],
  emotion: ['Calm', 'Focused', 'Confident', 'Anxious', 'Impatient', 'Frustrated', 'FOMO', 'Tired', 'Revenge'],
  timeframe: ['1m', '2m', '3m', '5m', '15m', '30m', '1h', '4h', 'Daily', 'Weekly'],
}

const MISTAKE_TAGS = [
  'FOMO entry', 'Chased price', 'Moved stop', 'Cut winner early', 'Oversized',
  'No HTF draw', 'Countertrend', 'Revenge trade', 'Traded outside window',
  'Ignored news', 'Hesitated on valid setup', 'Overtraded',
]

export function seedIfEmpty() {
  // One marker for the whole default set, rather than a per-table row count.
  // A migration that inserts into any of these tables would otherwise make the
  // database look already-seeded and skip everything else.
  const marker = db.prepare("SELECT value FROM app_meta WHERE key = 'seeded_at'").get()
  if (marker) return

  {
    const insertPlaybook = db.prepare(
      'INSERT INTO playbooks (name, asset_class, description, sort_order) VALUES (?, ?, ?, ?)',
    )
    const insertRule = db.prepare(
      'INSERT INTO rules (playbook_id, section, text, detail, is_critical, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    )

    const futuresId = Number(
      insertPlaybook.run(
        'Futures - ICT Model',
        'futures',
        'High time frame draw on liquidity, 15m FVG retracement, 1m-5m IFVG entry trigger.',
        0,
      ).lastInsertRowid,
    )
    FUTURES_RULES.forEach(([section, text, detail, critical], i) =>
      insertRule.run(futuresId, section, text, detail, critical, i),
    )

    const optionsId = Number(
      insertPlaybook.run(
        'Options - Swing',
        'options',
        'A+ setups only, sized for the setup and whatever catalysts are in the way.',
        1,
      ).lastInsertRowid,
    )
    OPTIONS_RULES.forEach(([section, text, detail, critical], i) =>
      insertRule.run(optionsId, section, text, detail, critical, i),
    )

    const cspId = Number(
      insertPlaybook.run(
        'Options - Cash-Secured Puts',
        'options',
        'Selling puts at strikes you would be content owning, targeting a 50-60% buy-back.',
        2,
      ).lastInsertRowid,
    )
    CSP_RULES.forEach(([section, text, detail, critical], i) =>
      insertRule.run(cspId, section, text, detail, critical, i),
    )

    console.log('[seed] created default playbooks and rules')
  }

  {
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name, kind) VALUES (?, ?)')
    MISTAKE_TAGS.forEach((name) => insertTag.run(name, 'mistake'))
    console.log('[seed] created default mistake tags')
  }

  {
    // OR IGNORE because a later migration may already have added one of these.
    const insertLookup = db.prepare('INSERT OR IGNORE INTO lookups (kind, value, sort_order) VALUES (?, ?, ?)')
    for (const [kind, values] of Object.entries(LOOKUPS)) {
      values.forEach((value, i) => insertLookup.run(kind, value, i))
    }
    console.log('[seed] created default dropdown lists')
  }

  db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('seeded_at', datetime('now'))").run()
}
