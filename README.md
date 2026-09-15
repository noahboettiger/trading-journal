# Trading Journal

A private, self-hosted journal for futures day trading and options swing trading.
Everything runs on your own machine and nothing is sent anywhere: no accounts, no
cloud, no analytics, no external fonts or CDNs. Your data is a single SQLite file
you can back up or copy.

---

## Running it

This runs on **your own computer**. There is no hosted version, so `localhost`
only works once the server is running on the machine you are browsing from.

You need [Node.js](https://nodejs.org) 22 or newer (`node --version` to check).

```bash
git clone https://github.com/noahboettiger/trading-journal.git
cd trading-journal
npm install
npm run build
npm start
```

Then open **http://localhost:4317**. Leave that terminal open; closing it stops
the server. Start it again any time with `npm start` from the project folder.

The server also prints a `network` address (something like `http://192.168.1.20:4317`).
Open that on your phone while it is on the same wifi and you get the same journal,
laid out for a small screen.

To try it with example data first:

```bash
npm run seed:demo      # 15 example trades across futures and options
npm run reset:trades   # delete them again, keeping your rules and lists
```

### While developing

```bash
npm run dev
```

Runs the API on 4317 and Vite on 5173 with hot reload. Open http://localhost:5173.

### Other commands

| Command | What it does |
| --- | --- |
| `npm run typecheck` | Type-check without emitting |
| `PORT=4318 npm start` | Run on a different port |

---

## What it tracks

### Trade categories

Every trade is filed under four independent axes, so you can slice the record any way
you need:

- **Instrument type** — futures or options
- **Trade style** — day trade, swing trade, scalp, position
- **Trade type** — your setup: LSRM, Judas Swing, 15m Continuation, IFVG Reversal,
  Break and Retest, and anything else you add
- **Buy or sell** (options) — so "show me every premium-selling trade and what it
  returned" is one filter, not a separate tracker

Trade type, style, session, source, emotional state and timeframe are all **editable
lists** you manage in Settings. Adding a new setup never requires a code change.

### Futures fields

Contracts, entry, exit, stop, target and point value. Point value auto-fills for
common symbols (MNQ, ES, GC, CL and friends) and stays editable. P&L, dollar risk and
planned R:R are computed from those, and every one of them can be overridden by hand.

### Options fields

Ticker, call/put, buy/sell, strike, expiration, contracts, entry and exit premium,
and how the position closed (bought to close, expired worthless, assigned, rolled,
sold to close). The app computes **days held**, **DTE at entry** and **DTE at exit**.
Delta, IV, theta and vega sit behind an optional toggle so the form stays short.

Risk for long premium defaults to the full debit paid, which is the real max loss.

### Cash-secured puts

Selling puts gets its own treatment, because R-multiples are the wrong lens for
premium selling. Enter the credit and the strike, and the journal derives:

| Figure | How it is calculated |
| --- | --- |
| Collateral | strike x 100 x contracts |
| Credit taken in | premium x 100 x contracts |
| Return on collateral | net P&L / collateral |
| Annualised return | return on collateral x (365 / days held) |
| Max profit captured | (credit - buy-back price) / credit |

That last one is the number to check against a 50-60% buy-back target. Expiring
worthless reads as 100%; a position that moved against you reads negative.

The Analytics page has a **Premium selling** section rolling these up across every
short put: total credit, average return on collateral, capital-weighted annualised
return, average days held, average share of max profit captured, and a breakdown of
how positions closed, so assignments are visible at a glance.

Annualised return is simple, not compounded, and assumes the capital could be
redeployed at the same rate. On a short sample it flatters fast winners.

### The rule checklist

This replaces a single yes/no "rules followed" flag. Each playbook carries its own
itemized list, grouped into sections, and every trade gets a real checkbox per rule.
Rules marked **critical** are flagged in red when broken, and you can note *why* a
rule was missed right under it.

Two playbooks ship by default:

**Futures - ICT Model**

| Section | Rule |
| --- | --- |
| Operational Readiness | Awake by 5:30 AM and at desk by 6:00 AM |
| Operational Readiness | No premarket FOMO, waited for the window to start |
| Model Compliance | HTF liquidity sweep or retracement to a 15m fair value gap present |
| Model Compliance | Clear, defined HTF draw on liquidity identified |
| Model Compliance | Trade taken in the direction of the defined HTF draw on liquidity |
| Model Compliance | Entry trigger: 1m-5m IFVG closure with CSD confirmed |
| Risk Management | Risk strictly locked at $250 maximum |
| Risk Management | Target meets minimum 1.5:1 risk to reward |
| Risk Management | Stop loss placed at the swing low/high |

**Options - Swing**

| Section | Rule |
| --- | --- |
| Setup Quality | A+ setup only |
| Setup Quality | Catalyst or news checked before entry |
| Risk Management | Not over-leveraged for this setup |
| Risk Management | Comfortable losing the full premium |
| Exit | Exit plan defined before entry |

**Options - Cash-Secured Puts**

| Section | Rule |
| --- | --- |
| Assignment | Genuinely happy to own the shares at this strike |
| Assignment | Collateral actually available and set aside |
| Setup Quality | A+ setup only |
| Setup Quality | Earnings and catalysts checked through expiration |
| Exit | Buy-back target set (50-60% of max profit) |
| Risk Management | Not over-leveraged across all open short puts |

Every one of these is editable in Settings, and you can add playbooks of your own.
Switching the instrument type on the form moves the playbook with it, so a put never
gets graded against the futures checklist.

#### Editing rules never rewrites history

When you save a trade, the **exact text of each rule is copied onto that trade**. Edit
a rule later, reword it, reorder it, delete it: every trade you already logged still
shows the rules as they read on the day you took it. Your historical compliance
percentage stays honest.

---

## What it shows you

**Dashboard** — net P&L, win rate, profit factor, average R, average trade, max
drawdown and current streak. Equity curve, monthly P&L bars, and the trading calendar.

**Trading calendar** — daily P&L in a month grid with a **weekly total** in the
trailing column, so a day, its week and the month all read off one view. The Calendar
page adds a daily/weekly/monthly breakdown table underneath.

**Rule compliance** — the part a normal journal cannot do. Two comparisons:

1. Trades where you followed every rule vs trades where you broke at least one, side
   by side on net P&L, win rate and average R.
2. **What broken rules cost**: for each individual rule, how often you break it and
   your net P&L on the trades where it was left unchecked, worst first.

**Analytics** — performance grouped by trade type, trade style, instrument, options
buying vs selling, ticker, session, day of week, timeframe, direction, source,
execution grade, emotional state, mistake tag and playbook.

**Session journal** — day-level notes separate from individual trades, with an
optional starter template.

### Room to actually write

Every trade carries four separate long-form fields rather than one notes box:

- **Thesis** — why you took it, the read you were trading
- **Notes** — what actually happened once you were in, and how you managed it
- **Lesson learned** — the one thing to carry forward
- **Reflections** — anything else

Plus a note on any individual rule explaining why it was missed. All four are
searchable from the trade log.

### Breakeven win rates

For reference, the win rate a given reward-to-risk needs just to break even is
`1 / (1 + R)`:

| Reward:Risk | Breakeven win rate |
| --- | --- |
| 1:1 | 50.0% |
| 1.5:1 | 40.0% |
| 2:1 | 33.3% |
| 3:1 | 25.0% |

Commissions push each of these slightly higher.

---

## Your data

Everything lives in `data/`:

```
data/
  journal.db      SQLite database: trades, rules, lists, journal entries
  uploads/        chart screenshots, as ordinary image files
```

Both are gitignored, so your trading record never ends up in version control.

**Chart screenshots** attach by paste (screenshot in TradingView, then Ctrl/Cmd+V
anywhere on the trade form), drag and drop, or a file picker.

**Backup** from Settings → Data downloads a JSON snapshot of every table, and restore
reads it back. Chart images are files rather than database rows, so copy
`data/uploads/` too when moving machines. Copying the whole `data/` folder is the
simplest complete backup.

---

## How it is built

| Layer | Choice | Why |
| --- | --- | --- |
| UI | React 19 + Vite + Tailwind | Fast to iterate, no SSR complexity for a single-user app |
| API | Express 5 | Small REST surface over the database |
| Database | SQLite via Node's built-in `node:sqlite` | Zero native dependencies, nothing to compile, one portable file |
| Charts | Recharts | |

Trade math lives in `shared/calc.js` and is imported by **both** the server and the
browser, so the number previewed while you type is produced by the same code that
computes it on save.

```
server/          Express API
  lib/db.js      schema and migrations
  lib/trades.js  persistence, derivation, filtering
  routes/        one file per resource
shared/calc.js   all trade math, used by server and UI
src/             React app
  pages/         one file per screen
  components/    RuleChecklist, PnlCalendar, ChartUpload, primitives
scripts/         demo seeding and reset helpers
```

### Adding a database column

Migrations in `server/lib/db.js` are an append-only array tracked by SQLite's
`user_version`. Add a new entry to the end rather than editing one that has already
run, then add the column name to `TRADE_COLUMNS` in `server/lib/trades.js`.
