CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL UNIQUE,
  default_service_min REAL NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'AVAILABLE'
);

CREATE TABLE IF NOT EXISTS staff_skills (
  staff_id INTEGER NOT NULL REFERENCES staff(id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  PRIMARY KEY (staff_id, service_id)
);

CREATE TABLE IF NOT EXISTS counters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  service_id INTEGER NOT NULL REFERENCES services(id),
  staff_id INTEGER REFERENCES staff(id),
  state TEXT NOT NULL DEFAULT 'OPEN',
  state_reason TEXT,
  pending_service_id INTEGER REFERENCES services(id)
);

CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  number INTEGER NOT NULL,
  service_id INTEGER NOT NULL REFERENCES services(id),
  is_priority INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'WAITING',
  score_offset REAL NOT NULL DEFAULT 0,
  counter_id INTEGER REFERENCES counters(id),
  transferred_from INTEGER REFERENCES services(id),
  hold_reason TEXT,
  skip_reason TEXT,
  created_at TEXT NOT NULL,
  called_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  held_at TEXT,
  skipped_at TEXT,
  cancelled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tokens_service_state ON tokens(service_id, state);

CREATE TABLE IF NOT EXISTS token_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER REFERENCES tokens(id),
  type TEXT NOT NULL,
  counter_id INTEGER,
  staff_id INTEGER,
  reason TEXT,
  at TEXT NOT NULL,
  meta TEXT
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL REFERENCES services(id),
  label TEXT NOT NULL,
  customer_facing INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS token_checklist (
  token_id INTEGER NOT NULL REFERENCES tokens(id),
  item_id INTEGER NOT NULL REFERENCES checklist_items(id),
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  PRIMARY KEY (token_id, item_id)
);

CREATE TABLE IF NOT EXISTS assistance_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  counter_id INTEGER NOT NULL REFERENCES counters(id),
  token_id INTEGER REFERENCES tokens(id),
  reason TEXT NOT NULL,
  note TEXT,
  state TEXT NOT NULL DEFAULT 'OPEN',
  created_by INTEGER,
  accepted_by INTEGER,
  created_at TEXT NOT NULL,
  accepted_at TEXT,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS system_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  payload TEXT,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_stats (
  service_id INTEGER PRIMARY KEY REFERENCES services(id),
  ewma_min REAL NOT NULL,
  no_show_rate REAL NOT NULL DEFAULT 0.05,
  updated_at TEXT NOT NULL
);