# Trading Journal

A private, self-hosted journal for futures day trading and options swing trading.
Everything runs on your own machine and nothing is sent anywhere: no accounts, no
cloud, no analytics, no external fonts or CDNs. Your data is a single SQLite file
you can back up or copy.

---

## Running it

This runs on **your own computer**. There is no hosted version, so `localhost`
only works once the server is running on the machine you are browsing from.

### Installing Node.js

Node.js is free and open source. There is nothing to buy and no account to make.

Go to **[nodejs.org](https://nodejs.org)** and download the **LTS** version (the
left-hand button, the one marked "Recommended for Most Users"). On Windows that
gives you a `.msi` installer, 64-bit by default, which is what you want.

Run it and click Next through every screen, accepting the defaults. Two things
worth knowing about that installer:

- The **custom setup** screen showing a tree of components is just letting you
  deselect parts. Leave it alone; the defaults are correct.
- There is a checkbox for **"Tools for Native Modules"** (it mentions Chocolatey,
  Python and Visual Studio build tools). **Leave it unchecked.** It installs
  several gigabytes and takes a long time. This journal has no components that
  need compiling, which was deliberate.

You may also see a page about Node being supported by Vercel and other partners.
That is sponsorship credit for the Node project, not something you sign up for.

Then open Command Prompt or PowerShell and check it worked:

```bash
node --version
```

You want v22 or higher. Node 24 is fine and is what the current installer gives
you; the whole test suite is verified against both.

### Getting the code

**With Git** (recommended, makes updates one command):

```bash
git clone https://github.com/noahboettiger/trading-journal.git
cd trading-journal
```

Windows does not ship with Git. Install it from
[git-scm.com](https://git-scm.com/download/win), accepting every default.
Later, `git pull` fetches any changes. Your `data/` folder is gitignored, so
updating never touches your trades.

**Without Git:** on the GitHub page, click the green **Code** button, then
**Download ZIP**, and extract it somewhere you will remember. Updating later
means downloading a fresh ZIP and copying your `data/` folder across, so Git is
worth the five minutes.

### Starting it

From inside the project folder:

```bash
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

### Opening it day to day

Typing commands every time gets old fast. Three ways to avoid it, easiest first.

**1. Double-click the launcher.** In the project folder on your computer there
is a file called **Start Journal.bat** (`start-journal.sh` on macOS and Linux).
Double-click it. It starts the journal and opens your browser automatically.
Right-click it and "Send to → Desktop" to get an icon you can click every
morning.

It installs dependencies and builds the app first if either is missing, so it
works on a copy you have just downloaded, with nothing typed.

You still get a window, and closing it stops the journal. That is the tradeoff
for the simplest possible setup.

Note that these files have to exist **on your computer**. Clicking a file on
github.com only displays it in the browser; that page is a view of the code, not
a copy of it. If a file is on GitHub but not in your folder, you need to update
your copy.

**2. Start it automatically when you log in.** Then it is always running, the
bookmark simply works, and there is no window and nothing to remember.

1. Press **Windows key + R**, type `shell:startup`, press Enter. A folder opens.
   Leave it open.
2. In another window, go to your project folder, then into `scripts\windows`.
3. Right-click **journal-background.vbs** and choose **Copy**. On Windows 11 you
   may need **Show more options** to see the full menu.
4. Back in the Startup folder, right-click an empty area and choose
   **Paste shortcut**.

That last step matters: **Paste shortcut**, not a plain Paste. A plain paste
copies the file out of the project and it can no longer find the rest of the
code. The script checks for this and tells you if it happens.

To start it right now without logging out, double-click that same
`journal-background.vbs`. Nothing visible happens, which is the point. Give it a
few seconds, then open the bookmark.

**Stopping it:** double-click **Stop Journal.bat**, or run `npm run stop`.

**Undoing autostart:** delete the shortcut from the Startup folder.

**If nothing loads:** check `data/server.log`, which is where a background copy
writes everything it would otherwise have printed to a window.

**3. Bookmark it.** Either way, bookmark **http://localhost:4317** and name it
"Trading Journal". That is a real URL and bookmarks fine.

### Getting updates

Double-click **Update Journal.bat** (`./update-journal.sh` elsewhere). It stops
a running copy, pulls the latest code, installs anything new, rebuilds, and
starts it again if it had been running in the background. Or by hand:

```bash
git pull
npm install
npm run build
```

Your `data/` folder is deliberately outside version control, so updating never
touches your trades, charts or backups.

If you pull an update and forget to rebuild, the journal notices on startup and
tells you rather than quietly serving the old version.

### Do you need to buy a domain?

No. There is nothing to pay for here, ever.

`localhost` is a name your computer already has for itself, built into every
operating system. It costs nothing because it never leaves your machine. Domain
names exist so *other people* can find *your* server on the public internet,
which is the opposite of what this is for.

If `http://localhost:4317` bothers you aesthetically you can add a nicer alias by
editing the Windows hosts file, but it needs administrator access, it still needs
the `:4317` on the end, and it changes nothing about how the journal works. Not
worth it. Bookmark it and forget the URL exists.

### While developing

```bash
npm run dev
```

Runs the API on 4317 and Vite on 5173 with hot reload. Open http://localhost:5173.

### Other commands

| Command | What it does |
| --- | --- |
| `npm run typecheck` | Type-check without emitting |
| `npm run backup` | Snapshot the database to `data/backups/` |
| `npm run reset:trades` | Delete every trade, keeping rules and lists |
| `npm run stop` | Stop a journal running in the background |

Settings such as the port and where data is stored go in a `.env` file. Copy
`.env.example` to `.env` to get started.

---

### Running it on a second computer

Install Node there, clone the repo, `npm install && npm run build && npm start`,
then copy your `data/` folder across. The journal has no licence check, no
account and no per-machine anything.

If both machines point `JOURNAL_DATA_DIR` at the same synced folder they share
one journal, but only run one at a time.

## Separate journals

A 45-day cash-secured put and a 20-minute MNQ scalp do not belong in the same
win rate. The name in the top left is a switcher, and everything downstream
(trades, dashboard, calendar, analytics, day notes) is scoped to whichever
journal is open.

Three ship by default, and you can add your own in Settings → Journals:

| Journal | Measured on |
| --- | --- |
| Day Trading | R multiples, win rate, profit factor, rule compliance |
| Swing Trading | the same, over longer holds |
| Cash-Secured Puts | return on collateral, annualised return, max profit captured, assignments |

The dashboard changes with the journal. A premium-selling book drops R multiples
and profit factor, which say nothing useful about a short put, and shows credit
taken in, collateral deployed, capital-weighted annualised return, average days
held, share of max profit captured and how many positions were assigned.

Each journal carries its own defaults, so logging into the cash-secured book
starts you on a short put with the right rule set attached. A trade can be moved
between journals from its Journal field.

Deleting a journal that still holds trades is refused rather than quietly
detaching them.

## Rolling a position

A roll is trade management, not a new trade. Buying back the contract in hand
and selling another keeps the position going, so the journal keeps it as one
record and totals the cash across the whole campaign.

This works on any options position, long premium or short. A call you bought and
rolled out to a further expiration follows the same path as a short put rolled
down and out; the only difference is the sign, since a long roll usually pays a
debit rather than taking in a credit.

Rolls fill two different ways, and both are supported:

- **One net price.** A diagonal or calendar roll usually fills as a single combo
  order, and the broker reports one net figure. Enter that: positive for a
  credit, negative for a debit. This is the default.
- **Two separate fills.** When you closed and reopened as separate orders, enter
  both prices and both land in the ledger.

Everything else follows from the premiums. You never compute a difference
yourself.

Worked example, straight off a broker statement:

| Date | Action | Contract | Price | Cash |
| --- | --- | --- | --- | --- |
| Sep 9 | Opened | 95 Put, exp Oct 16 | 5.90 | +$590 |
| Sep 10 | Rolled into | 90 Put, exp Nov 20 | 3.85 net | +$385 |
| Sep 21 | Closed | | 6.70 | -$670 |
| | | | **Net** | **+$305** |

Across the chain, collateral follows the contract held **now** (a roll can move
the strike or the size), days to expiration counts against the current leg, days
held covers the whole campaign, and max profit captured measures against
everything taken in.

**An open position that has been rolled has no realised P&L.** Only closing the
final leg realises it, since a roll closes a leg while the position carries on.

### P&L is calculated, not typed

For options the premiums are the source of truth: enter what you bought and sold
at and the P&L, return on collateral and annualised return follow. The Net P&L
field is an override, and it only takes effect if you type in it. Leaving it
alone keeps the figure live, so correcting a premium later corrects everything
downstream.

## Scaling out of a position

Taking a piece off is not a closed trade. Sell one of three contracts and the
journal records that fill on its own line, while the position stays open with
two still working.

Add a line per fill under **Scale out** on the trade form: the date, how many
contracts went out, and the price they went out at. The form and the review card
both show how many contracts are left and what has been banked so far.

Worked example, three contracts bought at 5.00:

| Date | Contracts | Price | Cash |
| --- | --- | --- | --- |
| Opened | 3 | 5.00 | -$1,500 |
| Oct 2 | 1 | 8.00 | +$800 |
| Oct 9 | 2 | 9.50 | +$1,900 |
| | | **Net** | **+$1,200** |

After the first fill the position reads **2 of 3 still open** and **$300 realised
so far**: the $800 taken in, less the $500 of cost basis that one contract
carried. Cost basis is allocated proportionally, so banking a partial never
front-loads or back-loads the entry.

**Net P&L stays unrealised until every contract is out.** The position leaves the
open section, and starts counting toward win rate, the equity curve and the
calendar, only once the contracts remaining reach zero.

Leaving the scale-out list empty keeps the simple case simple: a single exit
premium closes the whole position exactly as it did before.

## Open and closed positions

The trade list separates positions that are still live from ones that are
finished, because they answer different questions. Open rows show days held,
days to expiration left, capital tied up and credit taken in. Closed rows show
risk, R, P&L and your two ratings.

**Open positions are never counted as realised.** They stay out of P&L, win
rate, the equity curve and the calendar, and appear instead as a banner on the
dashboard showing how much capital is committed. A position counts only once you
set its status to closed.

## What it tracks

### Trade categories

Every trade is filed under four independent axes, so you can slice the record any way
you need:

- **Instrument type**: futures or options
- **Trade style**: day trade, swing trade, cash-secured put, scalp, position
- **Entry model**, your setup: Freestyle, iFVG Reversal, Mech Model, Break and
  Retest, 2022 Model, Unicorn Model, and anything else you add
- **Buy or sell** (options), so "show me every premium-selling trade and what it
  returned" is one filter, not a separate tracker

Entry model, style, session, source, emotional state and timeframe are all **editable
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

**Dashboard**: net P&L, win rate, profit factor, average R, average trade, max
drawdown and current streak. Equity curve, monthly P&L bars, and the trading calendar.

**Trading calendar**: daily P&L in a month grid with a **weekly total** in the
trailing column, so a day, its week and the month all read off one view. The Calendar
page adds a daily/weekly/monthly breakdown table underneath.

**Rule compliance**, the part a normal journal cannot do. Two comparisons:

1. Trades where you followed every rule vs trades where you broke at least one, side
   by side on net P&L, win rate and average R.
2. **What broken rules cost**: for each individual rule, how often you break it and
   your net P&L on the trades where it was left unchecked, worst first.

**Analytics**: performance grouped by trade type, trade style, instrument, options
buying vs selling, ticker, session, day of week, timeframe, direction, source,
execution grade, emotional state, mistake tag and playbook.

**Session journal**: day-level notes separate from individual trades, with an
optional starter template.

### Room to actually write

Every trade carries four separate long-form fields rather than one notes box:

- **Thesis**: why you took it, the read you were trading
- **Notes**: what actually happened once you were in, and how you managed it
- **Lesson learned**: the one thing to carry forward
- **Reflections**: anything else

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

## Where your data actually lives

There is no cloud here, local or otherwise. Here is the whole picture:

1. `npm start` launches a program on your computer. That is all "a server" means:
   a program that answers requests. It does not have to be in a data centre.
2. That program listens on port 4317 of your own machine.
3. Your browser talks to it at `localhost`, which means *this computer*. The
   request goes out of the browser and straight back into your own machine. It
   never touches your router, your ISP, or the internet.
4. The program reads and writes one file: `data/journal.db`.

That file is an ordinary file on your hard drive, no different from a photo or a
Word document. You can see it in Finder or File Explorer, copy it to a USB stick,
or email it to yourself.

The closest familiar comparison is Excel. Excel is a program on your computer and
your spreadsheet is a file on your disk. This is the same, except you look at it
through a browser tab instead of Excel's window. The browser is just the display.

```
data/
  journal.db      every trade, rule, checklist result and journal entry
  uploads/        chart screenshots, as ordinary .png files
  backups/        automatic snapshots (see below)
```

All of it is gitignored, so your trading record never gets pushed to GitHub.

### What happens when you log a trade

Concretely, from pasting a screenshot to bytes on your disk:

1. **You paste the chart.** The browser sends the image to the program running on
   your computer, which writes it into `data/uploads/` with a generated name:

   ```
   data/uploads/1789451556257-44fc98fdbb18.png
   ```

   It is a normal PNG. You can open it in Preview or Photos.

2. **You fill in the fields and hit save.** Everything you typed becomes one row
   in `data/journal.db`:

   ```
   trade_no     21
   symbol       GC
   direction    short
   trade_date   2026-09-15
   setup        LSRM
   net_pnl      700
   risk_amount  350
   thesis       Swept the NY pm high then displaced lower. Bearish 15m MSS...
   image        /uploads/1789451556257-44fc98fdbb18.png
   ```

   Your checklist answers, notes, lesson and mistake tags go in alongside it.

3. **That is the whole story.** Two things on your hard drive now hold that
   trade: the database file and the image file. The database stores the image's
   *path*, not the image itself, which is why copying the whole `data/` folder is
   the complete backup and copying `journal.db` alone leaves your charts behind.

### Does it survive?

**Yes** through all of these: closing the terminal, quitting the browser,
restarting your computer, updating the app with `git pull`, running it for years.
The file sits on disk until something deletes it.

**No** if the hard drive dies, the laptop is lost or stolen, or you delete the
project folder. That is the real risk, and it is the same risk as any other file
on your computer.

Also worth knowing: cloning this repo somewhere else gives you an **empty**
journal, because `data/` is deliberately not in version control. Moving machines
means copying the `data/` folder across yourself.

### Backups

**Every time you save a trade, the journal backs itself up.** Create, edit or
delete, and within a few seconds `data/backups/journal-latest.db` is a complete
copy including that change. It is written to a temporary file and renamed into
place, so a crash mid-write can never destroy the previous good copy. Closing the
server flushes it immediately.

On top of that, a **timestamped snapshot once a day**, keeping the 30 most
recent. The rolling copy answers "did I just lose what I typed"; the daily ones
answer "can I get back to how this looked two weeks ago". You can also take one
on demand:

```bash
npm run backup
```

or press **Snapshot now** in Settings → Data. To recover, copy a snapshot over
`data/journal.db` while the server is stopped, and start it again.

These snapshots use SQLite's `VACUUM INTO` rather than a plain file copy, and the
difference is not academic. The journal runs in WAL mode, which means recent
writes live in `journal.db-wal` until SQLite folds them in. Copying `journal.db`
on its own can hand you a database that opens with **no tables at all**. Use the
snapshots, or copy the entire `data/` folder, never `journal.db` by itself.

Settings → Data also has a JSON export covering trades, rules and lists. That one
is human-readable and portable, but it does not include your chart images.

### Settings, without fighting your shell

Copy `.env.example` to `.env` and edit it. The journal says `[config] loaded .env`
on startup when it finds one, and stays quiet when it does not. Every option below goes in that file,
one per line, and works identically on Windows, macOS and Linux:

```
JOURNAL_BACKUP_DIR=C:\Users\YourName\My Drive\TradingJournalBackups
```

Then `npm start` as usual. The file is gitignored and never leaves your machine.

### Protecting against a dead drive

Two ways, and the first is the safer default.

**Option A: backups only to the cloud (recommended)**

Keep the live database on local disk and send only the snapshots to a synced
folder. In your `.env`:

```
JOURNAL_BACKUP_DIR=C:\Users\YourName\My Drive\TradingJournalBackups
```

Snapshots are write-once files, so a sync service handles them perfectly. The
live database stays on a real disk where file locking works. You get
off-machine protection with none of the risk below.

**Option B: everything in the cloud folder**

```
JOURNAL_DATA_DIR=C:\Users\YourName\Dropbox\TradingJournal
```

The database, chart screenshots and snapshots all move there, which also lets a
second computer pick up the same journal. Two warnings:

- **Google Drive needs a setting change for this.** Drive for Desktop defaults
  to *streaming*, where files live in the cloud and are fetched on demand
  through a virtual drive. A live SQLite database on a virtual filesystem can
  corrupt, because the file locking it depends on is not reliably supported.
  If you want Option B on Google Drive, switch Drive to **Mirror files**
  (Drive preferences → Google Drive → My Drive syncing options → Mirror files),
  which keeps a real copy on your disk. Dropbox and iCloud Drive mirror by
  default, so they are fine as-is. If you would rather not think about any of
  this, use Option A.
- **Never run the journal on two machines against the same synced folder at
  once.** Sync services do not understand database locking and you will get a
  conflicted copy. One machine at a time.

### How does that relate to the hosting?

It does not, and this is worth being clear about because the two get conflated.

Putting your data in Google Drive does **not** mean Google is hosting the app.
Drive's software keeps a folder on your disk in sync with their servers. As far
as the journal is concerned that folder is just a path, no different from
`Documents`. The server still runs on your computer, your browser still talks to
`localhost`, and none of your page loads go anywhere near Google.

Two separate questions, which you can answer independently:

| Question | Answer here |
| --- | --- |
| Who runs the program? | Your computer, via `npm start` |
| Where do the resulting files sit? | Wherever you point it, including a synced folder |

Changing the second does not change the first.

### Do you have to use Node.js?

**Yes, always, regardless of the web address.** Something has to run the program
that answers the browser, and for this app that something is Node.js. This holds
whether the address is `localhost:4317`, `192.168.1.20:4317` from your phone, or
a public domain. The address only changes *how you reach* the program. It never
changes the fact that the program is running.

What does change is *whose computer* runs it. Right now it is yours. If it were
hosted, it would be a rented machine in a data centre, and that machine would
still be running Node.js.

Vercel is not an alternative to Node. They are different kinds of thing:

- **Node.js** is a program that runs JavaScript. It is the engine.
- **Vercel** is a company that rents you servers in their data centres. Those
  servers run Node.js.

So the real question is not Node versus Vercel, it is *whose computer runs this*.

**Vercel would not work with this app as written.** Their servers have a
throwaway filesystem: it is wiped on every deploy and serverless functions get a
fresh one each time. A SQLite file cannot survive that, and neither can your
uploaded chart images. Making it work would mean swapping SQLite for a hosted
database and moving images to hosted file storage, which also means your entire
trading record lives on someone else's servers. For a journal you described as
private and single-user, that is a lot of cost and complexity for no benefit.

If you ever do want it reachable from anywhere, there are two better paths than
rewriting for Vercel:

- **[Tailscale](https://tailscale.com)** puts your own machine on a private
  network you can reach from your phone anywhere, with no code changes and
  nothing hosted. This keeps every guarantee above intact.
- **[Turso](https://turso.tech)** is hosted SQLite, so the queries would mostly
  carry over rather than needing a rewrite. Chart images would still need
  somewhere to live.

Neither is worth doing until you have been using the journal long enough to know
you want it.

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
