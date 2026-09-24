ALTER TABLE capability_observations ADD COLUMN accepted_permissions TEXT;
ALTER TABLE capability_observations ADD COLUMN scope_expected INTEGER;
ALTER TABLE capability_observations ADD COLUMN scope_observed INTEGER;
ALTER TABLE capability_observations ADD COLUMN scope_available INTEGER;
ALTER TABLE capability_observations ADD COLUMN scope_permission_denied INTEGER;
ALTER TABLE capability_observations ADD COLUMN scope_error INTEGER;

CREATE TABLE IF NOT EXISTS capability_scope_observations (
  capability_key TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('repository', 'organization', 'account')),
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL,
  permission_state TEXT NOT NULL,
  data_state TEXT NOT NULL,
  last_attempt_at TEXT NOT NULL,
  last_success_at TEXT,
  last_http_status INTEGER,
  last_error TEXT,
  accepted_permissions TEXT,
  PRIMARY KEY (capability_key, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_capability_scope_observations_capability
  ON capability_scope_observations(capability_key, last_attempt_at DESC);

CREATE INDEX IF NOT EXISTS idx_capability_scope_observations_scope
  ON capability_scope_observations(scope_type, scope_id, last_attempt_at DESC);
