CREATE TABLE IF NOT EXISTS route_rate_limit_counters (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_route_rate_limit_counters_reset_at
  ON route_rate_limit_counters(reset_at);
