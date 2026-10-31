-- Run ONLY against the separate D1 database named h2o-apple-review.
-- No production data, member IDs, calendars, certificates, or personal evidence.
CREATE TABLE IF NOT EXISTS review_replies (
    event_id TEXT PRIMARY KEY CHECK (event_id IN ('demo-probe','demo-unterricht','demo-sonderprobe')),
    status TEXT NOT NULL CHECK (status IN ('yes','excused','maybe')),
    updated_at INTEGER NOT NULL
);
