-- Migration 008: Secure Uploads, Quotas, Artifacts, and Background Tasks
-- Schema: cbpms_private (isolated, server-only)
-- All tables are completely inaccessible to anon/authenticated/public roles.

CREATE SCHEMA IF NOT EXISTS cbpms_private;

-- 1. Upload Batches
CREATE TABLE IF NOT EXISTS cbpms_private.upload_batches (
    id VARCHAR(128) PRIMARY KEY,
    principal_type VARCHAR(32) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    shop_id VARCHAR(128),
    purpose VARCHAR(64) NOT NULL,
    access_mode VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    idempotency_key VARCHAR(128),
    total_items INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_upload_batches_principal 
    ON cbpms_private.upload_batches (principal_id, status);
CREATE INDEX IF NOT EXISTS idx_upload_batches_expires 
    ON cbpms_private.upload_batches (expires_at) WHERE status IN ('pending', 'completed');
CREATE UNIQUE INDEX IF NOT EXISTS uq_upload_batches_idempotency 
    ON cbpms_private.upload_batches (principal_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. Upload Items
CREATE TABLE IF NOT EXISTS cbpms_private.upload_items (
    id VARCHAR(128) PRIMARY KEY,
    batch_id VARCHAR(128) NOT NULL REFERENCES cbpms_private.upload_batches(id) ON DELETE CASCADE,
    item_index INT NOT NULL,
    declared_name VARCHAR(255) NOT NULL,
    declared_size_bytes BIGINT NOT NULL,
    declared_mime VARCHAR(128) NOT NULL,
    enforced_ceiling_bytes BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    quarantine_path VARCHAR(512) NOT NULL,
    canonical_path VARCHAR(512),
    observed_size_bytes BIGINT,
    observed_sha256 VARCHAR(64),
    page_count INT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_upload_items_batch 
    ON cbpms_private.upload_items (batch_id, item_index);

-- 3. Guest Upload Sessions
CREATE TABLE IF NOT EXISTS cbpms_private.guest_upload_sessions (
    id VARCHAR(128) PRIMARY KEY,
    session_hash VARCHAR(128) NOT NULL UNIQUE,
    shop_id VARCHAR(128) NOT NULL,
    ip_fingerprint VARCHAR(128),
    captcha_verified BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 4. Quota Accounts (User storage balances)
CREATE TABLE IF NOT EXISTS cbpms_private.quota_accounts (
    id VARCHAR(128) PRIMARY KEY,
    active_storage_bytes BIGINT NOT NULL DEFAULT 0,
    outstanding_reservation_bytes BIGINT NOT NULL DEFAULT 0,
    max_storage_bytes BIGINT NOT NULL DEFAULT 100000000,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 5. Quota Daily Usage (UTC Admission calendar ledger)
CREATE TABLE IF NOT EXISTS cbpms_private.quota_daily_usage (
    id VARCHAR(128) PRIMARY KEY,
    account_id VARCHAR(128) NOT NULL,
    usage_date DATE NOT NULL,
    charged_admission_bytes BIGINT NOT NULL DEFAULT 0,
    outstanding_reservation_bytes BIGINT NOT NULL DEFAULT 0,
    max_admission_bytes BIGINT NOT NULL DEFAULT 100000000,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT uq_quota_daily_account_date UNIQUE (account_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_quota_daily_account_date 
    ON cbpms_private.quota_daily_usage (account_id, usage_date);

-- 6. Quota Events (Immutable audit ledger for reservations & settlements)
CREATE TABLE IF NOT EXISTS cbpms_private.quota_events (
    id VARCHAR(128) PRIMARY KEY,
    account_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    delta_active BIGINT NOT NULL DEFAULT 0,
    delta_reserved BIGINT NOT NULL DEFAULT 0,
    delta_daily BIGINT NOT NULL DEFAULT 0,
    batch_id VARCHAR(128),
    item_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_quota_events_account 
    ON cbpms_private.quota_events (account_id, created_at);

-- 7. Object Artifacts (Authoritative references to physical storage objects)
CREATE TABLE IF NOT EXISTS cbpms_private.object_artifacts (
    id VARCHAR(128) PRIMARY KEY,
    storage_bucket VARCHAR(128) NOT NULL,
    storage_path VARCHAR(512) NOT NULL UNIQUE,
    artifact_type VARCHAR(32) NOT NULL,
    purpose VARCHAR(64) NOT NULL,
    access_mode VARCHAR(32) NOT NULL,
    owner_id VARCHAR(128),
    size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_artifacts_owner 
    ON cbpms_private.object_artifacts (owner_id, access_mode);
CREATE INDEX IF NOT EXISTS idx_artifacts_expires 
    ON cbpms_private.object_artifacts (expires_at) WHERE deleted_at IS NULL;

-- 8. Background Tasks (Outbox & durable task leases)
CREATE TABLE IF NOT EXISTS cbpms_private.background_tasks (
    id VARCHAR(128) PRIMARY KEY,
    task_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(128),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    leased_until TIMESTAMPTZ,
    leased_by VARCHAR(128),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_bg_tasks_pending 
    ON cbpms_private.background_tasks (status, run_after) WHERE status = 'pending';

-- Security Hardening: Revoke all public/anon/authenticated permissions and enable RLS
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'upload_batches',
        'upload_items',
        'guest_upload_sessions',
        'quota_accounts',
        'quota_daily_usage',
        'quota_events',
        'object_artifacts',
        'background_tasks'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('REVOKE ALL ON cbpms_private.%I FROM PUBLIC, anon, authenticated;', tbl);
        EXECUTE format('ALTER TABLE cbpms_private.%I ENABLE ROW LEVEL SECURITY;', tbl);
    END LOOP;
END $$;
