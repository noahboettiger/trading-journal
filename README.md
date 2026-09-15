# Trading Journal

A private, self-hosted journal for futures day trading and options swing trading.
Everything runs on your own machine and nothing is sent anywhere: no accounts, no
cloud, no analytics, no external fonts or CDNs. Your data is a single SQLite file
you can back up or copy.

---

## Running it

```bash
npm install
npm run build
npm start
```

Then open **http://localhost:4317**.

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

Ticker, call/put, buy/sell, strike, expiration, contracts, entry and exit premium.
The app computes **days held**, **DTE at entry**, **DTE at exit** and **return on the
premium at risk**. Delta, IV, theta and vega sit behind an optional toggle so the form
stays short when you do not need them.

Risk for long premium defaults to the full debit paid, which is the real max loss.
Short premium has no knowable max loss without knowing whether it is cash-secured,
spread or naked, so that stays a manual entry.

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

**Options - Swing** ships a starter set covering thesis, structure and risk. Edit it
in Settings to match how you actually trade.

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
