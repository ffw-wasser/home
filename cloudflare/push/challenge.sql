-- Additive only. Existing accounts, reminders and payments are preserved.
CREATE TABLE IF NOT EXISTS challenge_pool (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS challenge_games (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL);
