-- Separate file test namespace; immutable R2 data and recoverable D1 versions.
CREATE TABLE IF NOT EXISTS storage_files (
 run TEXT NOT NULL REFERENCES storage_states(run),
 id TEXT NOT NULL,
 parent TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('file','folder')),
 payload TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>0),
 deleted_at INTEGER,
 PRIMARY KEY(run,id)
);
CREATE INDEX IF NOT EXISTS storage_files_parent ON storage_files(run,parent);
CREATE TABLE IF NOT EXISTS storage_file_versions (
 run TEXT NOT NULL,
 id TEXT NOT NULL,
 version INTEGER NOT NULL,
 payload TEXT NOT NULL,
 deleted_at INTEGER,
 PRIMARY KEY(run,id,version),
 FOREIGN KEY(run,id) REFERENCES storage_files(run,id)
);
CREATE TABLE IF NOT EXISTS storage_file_receipts (
 run TEXT NOT NULL REFERENCES storage_states(run),
 operation_id TEXT NOT NULL,
 digest TEXT NOT NULL,
 id TEXT NOT NULL,
 version INTEGER NOT NULL,
 PRIMARY KEY(run,operation_id)
);
