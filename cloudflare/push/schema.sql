CREATE TABLE IF NOT EXISTS accounts (alias TEXT PRIMARY KEY, revision TEXT NOT NULL, last_sent INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, alias TEXT NOT NULL, revision TEXT NOT NULL, endpoint TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS devices_account ON devices(alias, revision);
CREATE TABLE IF NOT EXISTS sends (id TEXT PRIMARY KEY, alias TEXT NOT NULL, status TEXT NOT NULL, accepted INTEGER NOT NULL, failed INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sends_created ON sends(created_at);
CREATE TABLE IF NOT EXISTS retired (alias TEXT NOT NULL, revision TEXT NOT NULL, PRIMARY KEY(alias,revision));

-- Encrypted phone requests. Completed IDs remain for safe retries.
CREATE TABLE IF NOT EXISTS commands (alias TEXT NOT NULL, revision TEXT NOT NULL, id TEXT NOT NULL, envelope TEXT NOT NULL, digest TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', result TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, PRIMARY KEY(alias,revision,id));
CREATE INDEX IF NOT EXISTS commands_pending ON commands(status,created_at);
