-- Additive tables only. Existing accounts, finances and challenge data are untouched.
CREATE TABLE IF NOT EXISTS portal_config (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS portal_calendar (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, fetched_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS portal_replies (event TEXT NOT NULL, member TEXT NOT NULL, payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(event,member));
CREATE TABLE IF NOT EXISTS portal_sends (id TEXT PRIMARY KEY, event TEXT NOT NULL, member TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', campaign TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS portal_sends_created ON portal_sends(created_at);

CREATE TABLE IF NOT EXISTS portal_roster (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS portal_devices (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS portal_rules (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS portal_birthdays (member TEXT NOT NULL, year INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(member,year));
CREATE TABLE IF NOT EXISTS portal_bonus_policy (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);

-- Encrypted current eigenangaben and immutable change events.
CREATE TABLE IF NOT EXISTS portal_evidence_entries(member TEXT NOT NULL,field TEXT NOT NULL,version INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(member,field));
CREATE TABLE IF NOT EXISTS portal_evidence_audit(member TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(member,id));

CREATE TABLE IF NOT EXISTS portal_groups (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
