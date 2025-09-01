\set ON_ERROR_STOP on
\connect tellermade

-- Extensions used by the app/schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Least-privilege grants for the app user
GRANT CONNECT ON DATABASE tellermade TO tm_app;
GRANT USAGE ON SCHEMA public TO tm_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tm_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO tm_app;
