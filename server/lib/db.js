import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DATA_DIR = process.env.JOURNAL_DATA_DIR || path.join(ROOT, 'data')
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
const DB_PATH = path.join(DATA_DIR, 'journal.db')

fs.mkdirSync(UPLOAD_DIR, { recursive: true })

export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

/**
 * Ordered, append-only migrations. Never edit a migration that has shipped;
 * add a new one instead. Tracked via SQLite's built-in user_version.
 */
const MIGRATIONS = [
  // 1 - core schema
  `
  -- Every editable dropdown in the app lives here: trade types, sources,
  -- sessions, emotional states, timeframes. Add to them from Settings
  -- without a code change.
  CREATE TABLE lookups (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kind        TEXT    NOT NULL,
    value       TEXT    NOT NULL,
    asset_class TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1,
    UNIQUE (kind, value)
  );
  CREATE INDEX idx_lookups_kind ON lookups(kind, sort_order);

  CREATE TABLE playbooks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    asset_class TEXT    NOT NULL DEFAULT 'futures',
    description TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE rules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    playbook_id INTEGER NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
    section     TEXT    NOT NULL DEFAULT 'Model Compliance',
    text        TEXT    NOT NULL,
    detail      TEXT,
    is_critical INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_rules_playbook ON rules(playbook_id, sort_order);

  CREATE TABLE trades (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_no          INTEGER NOT NULL UNIQUE,
    playbook_id       INTEGER REFERENCES playbooks(id) ON DELETE SET NULL,

    asset_class       TEXT    NOT NULL DEFAULT 'futures',
    trade_style       TEXT    NOT NULL DEFAULT 'Day Trade',
    symbol            TEXT    NOT NULL,
    direction         TEXT    NOT NULL DEFAULT 'long',
    status            TEXT    NOT NULL DEFAULT 'closed',
    outcome           TEXT,

    trade_date        TEXT    NOT NULL,
    exit_date         TEXT,
    entry_time        TEXT,
    exit_time         TEXT,
    session           TEXT,
    timeframe         TEXT,
    setup             TEXT,
    trade_source      TEXT,

    contracts         REAL,
    entry_price       REAL,
    exit_price        REAL,
    stop_price        REAL,
    target_price      REAL,
    point_value       REAL,

    option_type       TEXT,
    option_side       TEXT,
    strike            REAL,
    expiration        TEXT,
    entry_premium     REAL,
    exit_premium      REAL,
    underlying_entry  REAL,
    underlying_stop   REAL,
    underlying_target REAL,
    dte_at_entry      INTEGER,
    delta             REAL,
    theta             REAL,
    vega              REAL,
    iv_at_entry       REAL,

    risk_amount       REAL,
    planned_rr        REAL,
    gross_pnl         REAL,
    commissions       REAL NOT NULL DEFAULT 0,
    net_pnl           REAL,
    result_r_override REAL,

    execution_grade   TEXT,
    emotional_state   TEXT,
    notes             TEXT,
    lesson_learned    TEXT,
    reflections       TEXT,

    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_trades_date   ON trades(trade_date DESC);
  CREATE INDEX idx_trades_symbol ON trades(symbol);
  CREATE INDEX idx_trades_style  ON trades(asset_class, trade_style);

  -- Rule text is SNAPSHOT here on save. Editing or deleting a rule later can
  -- never rewrite how a past trade was graded.
  CREATE TABLE trade_rule_checks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id   INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    rule_id    INTEGER REFERENCES rules(id) ON DELETE SET NULL,
    section    TEXT    NOT NULL,
    rule_text  TEXT    NOT NULL,
    is_critical INTEGER NOT NULL DEFAULT 0,
    checked    INTEGER NOT NULL DEFAULT 0,
    note       TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_checks_trade ON trade_rule_checks(trade_id, sort_order);

  CREATE TABLE tags (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    kind  TEXT NOT NULL DEFAULT 'mistake',
    UNIQUE (name, kind)
  );

  CREATE TABLE trade_tags (
    trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags(id)   ON DELETE CASCADE,
    PRIMARY KEY (trade_id, tag_id)
  );

  CREATE TABLE trade_images (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id   INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    path       TEXT    NOT NULL,
    caption    TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_images_trade ON trade_images(trade_id, sort_order);

  CREATE TABLE journal_entries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_date TEXT NOT NULL,
    session    TEXT,
    content    TEXT,
    mood       TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (entry_date, session)
  );
  `,

  // 2 - cash-secured put tracking and a dedicated thesis field
  `
  ALTER TABLE trades ADD COLUMN close_method TEXT;
  ALTER TABLE trades ADD COLUMN collateral   REAL;
  ALTER TABLE trades ADD COLUMN thesis       TEXT;
  `,

  // 3 - setup quality rating, separate from how well it was executed
  `
  ALTER TABLE trades ADD COLUMN trade_rating TEXT;
  `,

  // 4 - condense the entry model list
  //
  // Trades store their entry model as text, so removing a list entry never
  // changes a trade that already used it. Only the dropdown shrinks.
  `
  DELETE FROM lookups
   WHERE kind = 'setup'
     AND value IN ('LSRM', 'Judas Swing', '15m Continuation', 'MSS Reversal', 'Liquidity Sweep Reversal');

  UPDATE lookups SET value = 'iFVG Reversal' WHERE kind = 'setup' AND value = 'IFVG Reversal';
  UPDATE trades  SET setup = 'iFVG Reversal' WHERE setup = 'IFVG Reversal';

  INSERT OR IGNORE INTO lookups (kind, value, sort_order) VALUES
    ('setup', 'Freestyle',       0),
    ('setup', 'iFVG Reversal',   1),
    ('setup', 'Mech Model',      2),
    ('setup', 'Break and Retest',3),
    ('setup', '2022 Model',      4),
    ('setup', 'Unicorn Model',   5);

  UPDATE lookups SET sort_order = 0 WHERE kind = 'setup' AND value = 'Freestyle';
  UPDATE lookups SET sort_order = 1 WHERE kind = 'setup' AND value = 'iFVG Reversal';
  UPDATE lookups SET sort_order = 2 WHERE kind = 'setup' AND value = 'Mech Model';
  UPDATE lookups SET sort_order = 3 WHERE kind = 'setup' AND value = 'Break and Retest';
  UPDATE lookups SET sort_order = 4 WHERE kind = 'setup' AND value = '2022 Model';
  UPDATE lookups SET sort_order = 5 WHERE kind = 'setup' AND value = 'Unicorn Model';
  `,

  // 5 - remember which money fields were typed by hand
  //
  // Without this, a value the trader entered gets silently recomputed from the
  // price fields on the next unrelated edit. Entry and exit prices are optional
  // reference points, so a figure derived from them must never overwrite the
  // real one. Existing trades are marked manual wherever they carry a value,
  // because those were all hand-entered.
  `
  ALTER TABLE trades ADD COLUMN manual_fields TEXT;

  UPDATE trades SET manual_fields = TRIM(
    (CASE WHEN net_pnl     IS NOT NULL THEN 'net_pnl,'     ELSE '' END) ||
    (CASE WHEN risk_amount IS NOT NULL THEN 'risk_amount'  ELSE '' END),
    ','
  );
  `,

  // 6 - separate journals
  //
  // A 45-day cash-secured put and a 20-minute MNQ scalp do not belong in the
  // same win rate, equity curve or calendar. Each journal keeps its own trades,
  // dashboard, analytics and day notes. Existing trades are sorted into the
  // right one by shape, so nothing needs reclassifying by hand.
  `
  CREATE TABLE journals (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT    NOT NULL UNIQUE,
    kind                TEXT    NOT NULL DEFAULT 'general',
    default_asset_class TEXT,
    default_trade_style TEXT,
    default_playbook_id INTEGER REFERENCES playbooks(id) ON DELETE SET NULL,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  ALTER TABLE trades          ADD COLUMN journal_id INTEGER REFERENCES journals(id) ON DELETE SET NULL;
  ALTER TABLE journal_entries ADD COLUMN journal_id INTEGER REFERENCES journals(id) ON DELETE SET NULL;

  INSERT INTO journals (name, kind, default_asset_class, default_trade_style, sort_order) VALUES
    ('Day Trading',       'futures_day',   'futures', 'Day Trade',   0),
    ('Swing Trading',     'options_swing', 'options', 'Swing Trade', 1),
    ('Cash-Secured Puts', 'options_csp',   'options', 'Swing Trade', 2);

  UPDATE journals SET default_playbook_id =
    (SELECT id FROM playbooks WHERE name LIKE 'Futures%' ORDER BY id LIMIT 1) WHERE kind = 'futures_day';
  UPDATE journals SET default_playbook_id =
    (SELECT id FROM playbooks WHERE name LIKE '%Swing%' ORDER BY id LIMIT 1) WHERE kind = 'options_swing';
  UPDATE journals SET default_playbook_id =
    (SELECT id FROM playbooks WHERE name LIKE '%Cash-Secured%' ORDER BY id LIMIT 1) WHERE kind = 'options_csp';

  -- Short puts are the cash-secured book; anything else in options is a swing;
  -- everything remaining is day trading.
  UPDATE trades SET journal_id = (SELECT id FROM journals WHERE kind = 'options_csp')
   WHERE asset_class = 'options' AND option_side = 'sell' AND option_type = 'put';
  UPDATE trades SET journal_id = (SELECT id FROM journals WHERE kind = 'options_swing')
   WHERE journal_id IS NULL AND asset_class = 'options';
  UPDATE trades SET journal_id = (SELECT id FROM journals WHERE kind = 'futures_day')
   WHERE journal_id IS NULL;

  CREATE INDEX idx_trades_journal ON trades(journal_id, trade_date DESC);
  `,

  // 7 - Cash-Secured Put is its own style, not a flavour of swing trading
  //
  // Placed after Swing Trade rather than appended, since it belongs with the
  // other options holding periods. Any styles added by hand keep their order.
  `
  INSERT OR IGNORE INTO lookups (kind, value, sort_order) VALUES ('style', 'Cash-Secured Put', 2);

  UPDATE lookups SET sort_order = 0 WHERE kind = 'style' AND value = 'Day Trade';
  UPDATE lookups SET sort_order = 1 WHERE kind = 'style' AND value = 'Swing Trade';
  UPDATE lookups SET sort_order = 2 WHERE kind = 'style' AND value = 'Cash-Secured Put';
  UPDATE lookups SET sort_order = 3 WHERE kind = 'style' AND value = 'Scalp';
  UPDATE lookups SET sort_order = 4 WHERE kind = 'style' AND value = 'Position';

  UPDATE journals SET default_trade_style = 'Cash-Secured Put' WHERE kind = 'options_csp';
  `,

  // 8 - record explicitly whether first-run defaults have been installed
  //
  // Seeding used to be guarded by "is this table empty", which broke the moment
  // a migration inserted into the same table: on a brand new database,
  // migration 7 added one style row, the guard saw a non-empty table, and the
  // whole default set (playbooks, rules, lists) was skipped. A marker is
  // independent of whatever else has written rows.
  //
  // Databases that already carry a playbook were seeded long ago, so they are
  // marked here rather than being seeded a second time.
  `
  CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT);

  INSERT INTO app_meta (key, value)
    SELECT 'seeded_at', datetime('now') WHERE EXISTS (SELECT 1 FROM playbooks);
  `,

  // 9 - rolls, as management of one position rather than separate trades
  //
  // A roll buys back the current contract and sells another. Splitting that
  // into two trades loses the fact that it is one campaign, inflates the trade
  // count and makes days held meaningless. Keeping only the final contract is
  // worse: the credit already banked on earlier legs disappears.
  //
  // The trade's own contract fields stay the ORIGINAL leg, so nothing needs
  // rewriting. Each roll records what it cost to close the leg in hand and the
  // contract opened in its place. Totals sum across the chain.
  `
  CREATE TABLE trade_rolls (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id       INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    rolled_on      TEXT,
    close_cost     REAL,
    new_strike     REAL,
    new_expiration TEXT,
    new_contracts  REAL,
    new_credit     REAL,
    commissions    REAL NOT NULL DEFAULT 0,
    note           TEXT,
    sort_order     INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_rolls_trade ON trade_rolls(trade_id, sort_order);
  `,

  // 10 - a roll is often one combo order with a single net price
  //
  // A diagonal roll fills as one order: the broker reports a net credit, not a
  // separate buy-back and sale. Asking for both forced those numbers to be
  // invented. net_credit records what the ticket actually said.
  `
  ALTER TABLE trade_rolls ADD COLUMN net_credit REAL;
  `,
]

function migrate() {
  const current = db.prepare('PRAGMA user_version').get().user_version
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[v])
      db.exec(`PRAGMA user_version = ${v + 1}`)
      db.exec('COMMIT')
      console.log(`[db] applied migration ${v + 1}`)
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
}

migrate()
