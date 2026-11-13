-- Preparation only: no change to active OneDrive, ledger, portal or identity data.
CREATE TABLE IF NOT EXISTS storage_migrations (
 id TEXT PRIMARY KEY,
 source_hash TEXT NOT NULL,
 manifest TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'staging' CHECK(state IN ('staging','verified')),
 created_at INTEGER NOT NULL,
 verified_at INTEGER
);
CREATE TABLE IF NOT EXISTS storage_migration_files (
 migration_id TEXT NOT NULL REFERENCES storage_migrations(id),
 file_id TEXT NOT NULL,
 size INTEGER NOT NULL,
 sha256 TEXT NOT NULL,
 verified_at INTEGER NOT NULL,
 PRIMARY KEY(migration_id,file_id)
);
