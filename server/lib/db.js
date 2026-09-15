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
