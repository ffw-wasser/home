-- Isolated rehearsal state only. No activation or change to existing application tables.
CREATE TABLE IF NOT EXISTS storage_states (
 run TEXT PRIMARY KEY REFERENCES storage_migrations(id),
 source_hash TEXT NOT NULL,
 payload TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>0),
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS storage_devices (
 id TEXT PRIMARY KEY,
 run TEXT NOT NULL REFERENCES storage_states(run),
 source_hash TEXT NOT NULL,
 token_hash TEXT NOT NULL UNIQUE,
 registration_hash TEXT NOT NULL,
 label TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS storage_devices_run ON storage_devices(run);
CREATE TABLE IF NOT EXISTS storage_state_receipts (
 run TEXT NOT NULL REFERENCES storage_states(run),
 operation_id TEXT NOT NULL,
 device_id TEXT NOT NULL REFERENCES storage_devices(id),
 digest TEXT NOT NULL,
 version INTEGER NOT NULL,
 PRIMARY KEY(run,operation_id)
);
