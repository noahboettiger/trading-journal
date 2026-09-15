/**
 * Fill the journal with example trades so you can see every screen populated
 * before logging anything real. Requires the server to be running.
 *
 *   npm start            # in one terminal
 *   npm run seed:demo    # in another
 *
 * Wipe them again with `npm run reset:trades`.
 */
const API = `http://localhost:${process.env.PORT || 4317}/api`

const post = async (path, body) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

const playbooks = await (await fetch(`${API}/playbooks`)).json()
const futures = playbooks.find((p) => p.asset_class === 'futures')
const options = playbooks.find((p) => p.asset_class === 'options')
const tags = await (await fetch(`${API}/tags?kind=mistake`)).json()
const tagId = (name) => tags.find((t) => t.name === name)?.id

const checksFor = (pb, brokenTexts = []) =>
  pb.rules.map((r, i) => ({
    rule_id: r.id, section: r.section, rule_text: r.text, is_critical: r.is_critical,
    checked: !brokenTexts.some((b) => r.text.includes(b)),
    note: brokenTexts.some((b) => r.text.includes(b)) ? 'Missed on this one' : null,
    sort_order: i,
  }))

const FUTURES = [
  ['2026-09-01', 'GC', 'short', 'Asia', '15m', 'LSRM', 350, 700, 'A', 'Calm', [], 'GC sweeps NY pm high and displaced lower to form bearish 15min MSS. Took the IFVG closure on the 3m.'],
  ['2026-09-02', 'MNQ', 'long', 'NY AM', '5m', 'Judas Swing', 250, 500, 'A', 'Focused', [], 'Classic Judas below the overnight low, reclaimed and ran to the PDH.'],
  ['2026-09-03', 'MNQ', 'short', 'NY AM', '5m', 'IFVG Reversal', 250, -250, 'B', 'Calm', [], 'Clean setup, just did not work. Stop at the swing high.'],
  ['2026-09-04', 'GC', 'long', 'London', '15m', 'LSRM', 250, 375, 'B', 'Calm', [], 'Half size into London open, target at the Asia high.'],
  ['2026-09-08', 'MNQ', 'long', 'NY AM', '3m', '15m Continuation', 420, -420, 'D', 'FOMO', ['Risk strictly locked'], 'Chased the entry after missing the first leg. Oversized to make it back.'],
  ['2026-09-09', 'MNQ', 'short', 'NY AM', '5m', 'Judas Swing', 250, 99.5, 'C', 'Impatient', ['Target meets minimum'], 'Cut it early before the target because it stalled.'],
  ['2026-09-10', 'GC', 'short', 'Asia', '15m', 'LSRM', 250, 600.5, 'A', 'Calm', [], 'Textbook. Waited for the sweep, entered on the 1m IFVG.'],
  ['2026-09-11', 'MNQ', 'long', 'NY AM', '5m', 'Break and Retest', 250, 716, 'A', 'Confident', [], 'Held for the full target into the PDH.'],
  ['2026-09-14', 'MNQ', 'short', 'NY PM', '5m', 'Freestyle', 261.5, -261.5, 'F', 'Frustrated', ['HTF liquidity sweep', 'Clear, defined HTF draw', 'No premarket FOMO'], 'No draw identified, traded out of boredom in the afternoon. Should not have been at the desk.'],
  ['2026-09-15', 'MNQ', 'long', 'NY AM', '3m', 'Freestyle', 263.25, -526.5, 'F', 'Revenge', ['Risk strictly locked', 'HTF liquidity sweep', 'Stop loss placed'], 'Revenge traded yesterday. Doubled size, no stop at structure.'],
]

for (const [date, sym, dir, session, tf, setup, risk, pnl, grade, emotion, broken, notes] of FUTURES) {
  await post('/trades', {
    asset_class: 'futures', trade_style: 'Day Trade', symbol: sym, direction: dir,
    trade_date: date, session, timeframe: tf, setup, trade_source: 'Prop',
    risk_amount: risk, net_pnl: pnl, execution_grade: grade, emotional_state: emotion,
    playbook_id: futures.id, notes,
    rule_checks: checksFor(futures, broken),
    tag_ids: [
      broken.some((b) => b.includes('Risk')) ? tagId('Oversized') : null,
      emotion === 'Revenge' ? tagId('Revenge trade') : null,
      emotion === 'FOMO' ? tagId('FOMO entry') : null,
      setup === 'Freestyle' && grade === 'F' ? tagId('No HTF draw') : null,
      grade === 'C' ? tagId('Cut winner early') : null,
    ].filter(Boolean),
  })
}

const OPTIONS = [
  ['2026-08-05', '2026-08-21', 'NVDA', 'long', 'call', 'buy', 185, '2026-09-18', 4, 5.2, 8.95, 'Break and Retest', 'B', 'Calm', [], 'Swing long into the gap fill. Sold half at 2R, let the rest run.'],
  ['2026-08-12', '2026-08-28', 'SPY', 'long', 'put', 'sell', 640, '2026-09-19', 2, 6.4, 1.15, 'Break and Retest', 'A', 'Calm', [], 'Cash secured put after the flush. Bought back at 80% of max profit.'],
  ['2026-08-20', '2026-09-04', 'TSLA', 'short', 'put', 'buy', 400, '2026-09-18', 3, 9.1, 4.2, 'IFVG Reversal', 'C', 'Anxious', ['21+ days to expiration'], 'Bought too close to expiry, theta ate it while I waited.'],
  ['2026-09-02', '2026-09-12', 'AAPL', 'long', 'call', 'buy', 250, '2026-10-16', 5, 3.4, 5.85, 'Judas Swing', 'B', 'Focused', [], 'Post-earnings continuation.'],
  ['2026-09-08', null, 'QQQ', 'short', 'call', 'sell', 620, '2026-10-16', 3, 4.8, 2.1, 'Break and Retest', 'A', 'Calm', [], 'Covered calls against the core position.'],
]

for (const [date, exitDate, sym, dir, type, side, strike, exp, qty, entryP, exitP, setup, grade, emotion, broken, notes] of OPTIONS) {
  await post('/trades', {
    asset_class: 'options', trade_style: 'Swing Trade', symbol: sym, direction: dir,
    option_type: type, option_side: side, strike, expiration: exp,
    trade_date: date, exit_date: exitDate, setup, trade_source: 'Personal',
    contracts: qty, entry_premium: entryP, exit_premium: exitP, commissions: qty * 1.3,
    ...(side === 'sell' ? { risk_amount: strike * qty * 100 * 0.2 } : {}),
    execution_grade: grade, emotional_state: emotion, playbook_id: options.id, notes,
    rule_checks: checksFor(options, broken),
    tag_ids: [],
  })
}

const stats = await (await fetch(`${API}/stats`)).json()
console.log(`seeded ${stats.summary.trades} trades, net ${stats.summary.netPnl.toFixed(2)}`)
