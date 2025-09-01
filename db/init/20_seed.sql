CREATE TABLE IF NOT EXISTS healthcheck (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  note TEXT NOT NULL DEFAULT 'ok'
);

INSERT INTO healthcheck (note) VALUES ('init ok');
