-- Additive migration; preserves existing records. Legacy email-owned records are
-- NOT automatically assigned to Google accounts (email is not a stable identity).
BEGIN;
CREATE SCHEMA IF NOT EXISTS cbpms_private;
DO $$
DECLARE tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['shops', 'jobs', 'users', 'sessions', 'attempts', 'documents', 'audit_events'] LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS cbpms_private.%I (id varchar(128) PRIMARY KEY, data jsonb NOT NULL)', tab);
    EXECUTE format('ALTER TABLE cbpms_private.%I ENABLE ROW LEVEL SECURITY', tab);
  END LOOP;
END $$;
REVOKE ALL ON SCHEMA cbpms_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA cbpms_private FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA cbpms_private REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
COMMENT ON SCHEMA cbpms_private IS 'Server-only CBPMS records. Do not add to exposed API schemas.';
COMMIT;
