CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  idempotency_key TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'cloudflare')),
  capability TEXT NOT NULL,
  source TEXT NOT NULL CHECK (
    source IN ('webhook', 'audit_log', 'snapshot_diff', 'reconciliation', 'provider_api', 'runtime', 'import', 'derived')
  ),
  coverage TEXT NOT NULL CHECK (
    coverage IN ('complete', 'partial', 'sampled', 'since_installation', 'since_first_observation', 'unknown')
  ),
  event TEXT NOT NULL,
  action TEXT,
  derived INTEGER NOT NULL CHECK (derived IN (0, 1)),
  resource_type TEXT,
  resource_id TEXT,
  repository TEXT,
  occurred_at TEXT,
  received_at TEXT NOT NULL,
  resource_json TEXT CHECK (
    resource_json IS NULL OR (json_valid(resource_json) AND length(resource_json) <= 4096)
  ),
  actor_json TEXT CHECK (
    actor_json IS NULL OR (json_valid(actor_json) AND length(actor_json) <= 4096)
  ),
  correlation_json TEXT NOT NULL CHECK (
    json_valid(correlation_json) AND length(correlation_json) <= 8192
  ),
  provenance_json TEXT NOT NULL CHECK (
    json_valid(provenance_json) AND length(provenance_json) <= 8192
  ),
  metadata_json TEXT NOT NULL CHECK (
    json_valid(metadata_json) AND length(metadata_json) <= 16384
  ),
  first_message_id TEXT NOT NULL,
  persisted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_capability_received
  ON events(capability, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_provider_received
  ON events(provider, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_repository_received
  ON events(repository, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_occurred
  ON events(occurred_at DESC);
