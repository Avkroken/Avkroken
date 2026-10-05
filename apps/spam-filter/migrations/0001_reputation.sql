CREATE TABLE IF NOT EXISTS sender_reputation (
  sender_key TEXT PRIMARY KEY,
  sender_domain TEXT NOT NULL,
  seen_count INTEGER NOT NULL DEFAULT 0,
  clean_count INTEGER NOT NULL DEFAULT 0,
  suspicious_count INTEGER NOT NULL DEFAULT 0,
  spam_count INTEGER NOT NULL DEFAULT 0,
  user_spam_count INTEGER NOT NULL DEFAULT 0,
  user_legitimate_count INTEGER NOT NULL DEFAULT 0,
  ai_spam_count INTEGER NOT NULL DEFAULT 0,
  ai_legitimate_count INTEGER NOT NULL DEFAULT 0,
  last_verdict TEXT NOT NULL DEFAULT 'unknown',
  last_ai_category TEXT,
  last_ai_confidence REAL,
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_key TEXT NOT NULL,
  sender_domain TEXT NOT NULL,
  label TEXT NOT NULL CHECK (label IN ('spam', 'legitimate')),
  heuristic_score INTEGER NOT NULL,
  ai_category TEXT,
  ai_confidence REAL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_events_sender_key
  ON feedback_events(sender_key);

CREATE INDEX IF NOT EXISTS idx_feedback_events_created_at
  ON feedback_events(created_at);
