-- Production pointer and recoverable state revisions; existing data stays intact.
CREATE TABLE IF NOT EXISTS storage_runtime (
 id INTEGER PRIMARY KEY CHECK(id=1),
 run TEXT NOT NULL REFERENCES storage_states(run),
 source_hash TEXT NOT NULL,
 version INTEGER NOT NULL,
 activated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS storage_state_versions (
 run TEXT NOT NULL REFERENCES storage_states(run),
 version INTEGER NOT NULL,
 payload TEXT NOT NULL,
 saved_at INTEGER NOT NULL,
 PRIMARY KEY(run,version)
);
CREATE TABLE IF NOT EXISTS storage_pairings (
 id TEXT PRIMARY KEY,
 run TEXT NOT NULL REFERENCES storage_states(run),
 source_hash TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 used_at INTEGER,
 device_id TEXT
);
