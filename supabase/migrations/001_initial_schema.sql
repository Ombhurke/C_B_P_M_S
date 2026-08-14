-- Migration: 001_initial_schema.sql
-- Description: Create initial schema for shops, printers, and print_jobs

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Multi-Tenant Shop Accounts
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    base_bw_rate NUMERIC(10, 2) NOT NULL DEFAULT 2.00,
    base_color_rate NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
    duplex_discount NUMERIC(10, 2) NOT NULL DEFAULT 0.50,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Store Printers
CREATE TABLE IF NOT EXISTS printers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    device_name VARCHAR(255) NOT NULL,
    driver_name VARCHAR(255),
    is_color_supported BOOLEAN NOT NULL DEFAULT TRUE,
    is_duplex_supported BOOLEAN NOT NULL DEFAULT TRUE,
    max_paper_size VARCHAR(50) NOT NULL DEFAULT 'A4',
    status VARCHAR(50) NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'busy', 'offline', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Ephemeral Print Queue
CREATE TABLE IF NOT EXISTS print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    page_count INT NOT NULL CHECK (page_count > 0),
    copy_count INT NOT NULL DEFAULT 1 CHECK (copy_count > 0),
    is_color BOOLEAN NOT NULL DEFAULT FALSE,
    duplex_mode VARCHAR(50) NOT NULL DEFAULT 'simplex' CHECK (duplex_mode IN ('simplex', 'duplex_long', 'duplex_short')),
    layout_nup INT NOT NULL DEFAULT 1 CHECK (layout_nup IN (1, 2, 4, 6)),
    page_range VARCHAR(100) DEFAULT 'all',
    total_cost NUMERIC(10, 2) NOT NULL CHECK (total_cost >= 0),
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_id VARCHAR(255),
    payment_method VARCHAR(50),
    release_token VARCHAR(6) NOT NULL,
    token_attempt_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    job_status VARCHAR(50) NOT NULL DEFAULT 'queued' CHECK (job_status IN ('staged', 'queued', 'processing', 'completed', 'expired', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '2 hours'),
    completed_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for optimal lookup and expiry sweeps
CREATE INDEX IF NOT EXISTS idx_print_jobs_shop_token ON print_jobs(shop_id, release_token);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status_expires ON print_jobs(job_status, expires_at);
CREATE INDEX IF NOT EXISTS idx_printers_shop_id ON printers(shop_id);
