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

  ['Risk Management', 'Risk strictly locked at $250 maximum', 'Hard dollar cap per trade.', 1],
  ['Risk Management', 'Target meets minimum 1.5:1 risk to reward', 'Planned target had to pay at least 1.5R before you took the entry.', 1],
  ['Risk Management', 'Stop loss placed at the swing low/high', 'Stop sits behind real structure, not at an arbitrary dollar distance.', 1],
]

const OPTIONS_RULES = [
  ['Thesis', 'Directional thesis written down before entry', 'Starter rule - edit in Settings to match your swing model.', 0],
  ['Thesis', 'Defined invalidation level on the underlying', 'You know the price that kills the idea.', 1],
  ['Thesis', 'Catalyst or timing window identified', 'Why now, and not three weeks from now.', 0],

  ['Structure', '21+ days to expiration at entry', 'Keeps you off the theta cliff unless the trade is explicitly a short-dated play.', 0],
  ['Structure', 'Not holding through earnings unless that is the thesis', 'Avoids unintended IV crush exposure.', 0],
  ['Structure', 'Implied volatility checked before paying up', 'Not buying premium into an IV spike by accident.', 0],

  ['Risk Management', 'Position sized off premium at risk, not contract count', 'Max loss in dollars is known at entry.', 1],
  ['Risk Management', 'Max loss acceptable if it goes to zero', 'For long premium, you are fine losing the whole debit.', 1],
  ['Risk Management', 'Exit plan defined before entry (target and time stop)', 'Both a price target and a date you will exit regardless.', 1],
  ['Risk Management', 'If selling premium: assignment outcome is acceptable', 'You would be content owning or delivering the shares at the strike.', 0],
]

/** Editable dropdown lists. Add to any of these from Settings. */
const LOOKUPS = {
  setup: [
    'LSRM', 'Freestyle', 'Judas Swing', '15m Continuation', 'IFVG Reversal',
    'Break and Retest', 'MSS Reversal', 'Liquidity Sweep Reversal',
  ],
  style: ['Day Trade', 'Swing Trade', 'Scalp', 'Position'],
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
  const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n

  if (count('playbooks') === 0) {
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
        'Starter rule set for swing and premium-selling options. Edit these in Settings to match your real model.',
        1,
      ).lastInsertRowid,
    )
    OPTIONS_RULES.forEach(([section, text, detail, critical], i) =>
      insertRule.run(optionsId, section, text, detail, critical, i),
    )

    console.log('[seed] created default playbooks and rules')
  }

  if (count('tags') === 0) {
    const insertTag = db.prepare('INSERT INTO tags (name, kind) VALUES (?, ?)')
    MISTAKE_TAGS.forEach((name) => insertTag.run(name, 'mistake'))
    console.log('[seed] created default mistake tags')
  }

  if (count('lookups') === 0) {
    const insertLookup = db.prepare('INSERT INTO lookups (kind, value, sort_order) VALUES (?, ?, ?)')
    for (const [kind, values] of Object.entries(LOOKUPS)) {
      values.forEach((value, i) => insertLookup.run(kind, value, i))
    }
    console.log('[seed] created default dropdown lists')
  }
}
