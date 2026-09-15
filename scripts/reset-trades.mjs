/**
 * Delete every trade, keeping playbooks, rules and dropdown lists intact.
 * Use this to clear the example data before you start logging real trades.
 *
 *   npm run reset:trades
 */
const API = `http://localhost:${process.env.PORT || 4317}/api`

const res = await fetch(`${API}/trades?withChildren=false`)
if (!res.ok) {
  console.error(`Could not reach the journal at ${API}. Is the server running?`)
  process.exit(1)
}
const trades = await res.json()
if (!trades.length) {
  console.log('No trades to delete.')
  process.exit(0)
}

for (const t of trades) {
  await fetch(`${API}/trades/${t.id}`, { method: 'DELETE' })
}
console.log(`Deleted ${trades.length} trade${trades.length === 1 ? '' : 's'}. Rules and lists are untouched.`)
