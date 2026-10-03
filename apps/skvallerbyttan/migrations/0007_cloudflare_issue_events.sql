CREATE TABLE cloudflare_events_v2 (
  delivery_id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('notifications', 'casb', 'issues')),
  event_type TEXT NOT NULL,
  event_id TEXT,
  state TEXT,
  account_id TEXT,
  policy_id TEXT,
  summary TEXT,
  occurred_at TEXT,
  received_at TEXT NOT NULL
);

INSERT INTO cloudflare_events_v2 (
  delivery_id, source, event_type, event_id, state, account_id, policy_id,
  summary, occurred_at, received_at
)
SELECT
  delivery_id, source, event_type, event_id, state, account_id, policy_id,
  summary, occurred_at, received_at
FROM cloudflare_events;

DROP TABLE cloudflare_events;

ALTER TABLE cloudflare_events_v2 RENAME TO cloudflare_events;

CREATE INDEX idx_cloudflare_events_source_received
  ON cloudflare_events(source, received_at);

CREATE INDEX idx_cloudflare_events_type_state_received
  ON cloudflare_events(event_type, state, received_at);
