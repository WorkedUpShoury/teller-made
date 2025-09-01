-- Create a dedicated, least-privileged app user (NOT a superuser)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tm_app') THEN
    CREATE ROLE tm_app LOGIN PASSWORD 'tm_app_password';
  END IF;
END$$;
