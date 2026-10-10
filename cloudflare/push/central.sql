-- Additive migration; existing reminders and request receipts stay intact.
CREATE TABLE IF NOT EXISTS ledger_meta (id INTEGER PRIMARY KEY CHECK(id=1), source TEXT NOT NULL, state TEXT NOT NULL, seq INTEGER NOT NULL DEFAULT 0, policy TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ledgers (member TEXT PRIMARY KEY, payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS ledger_access (alias TEXT PRIMARY KEY, revision TEXT NOT NULL, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ledger_resets (id TEXT PRIMARY KEY, backup TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ledger_reset_items (reset_id TEXT NOT NULL, member TEXT NOT NULL, payload TEXT NOT NULL, seq INTEGER NOT NULL, PRIMARY KEY(reset_id,member));
