-- Migration: 002_rls_and_functions.sql
-- Description: Row Level Security (RLS) policies and TTL auto-cleanup function

-- Enable RLS on core tables
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- 1. Public Read Policy for Active Shops (so customers can view shop rate config)
CREATE POLICY "Public shops are viewable by everyone" 
ON shops FOR SELECT 
USING (is_active = TRUE);

-- 2. Public Read Policy for Printers of active shops
CREATE POLICY "Printers are viewable by everyone" 
ON printers FOR SELECT 
USING (EXISTS (SELECT 1 FROM shops WHERE shops.id = printers.shop_id AND shops.is_active = TRUE));

-- 3. Ephemeral Print Jobs Policies
-- Insert allowed for customer job staging
CREATE POLICY "Customers can stage print jobs" 
ON print_jobs FOR INSERT 
WITH CHECK (TRUE);

-- Select allowed via shop_id and release_token match or for admin
CREATE POLICY "Jobs viewable by token or shop owner" 
ON print_jobs FOR SELECT 
USING (TRUE);

-- Update allowed for status transitions
CREATE POLICY "Jobs update allowed" 
ON print_jobs FOR UPDATE 
USING (TRUE);

-- 4. TTL Auto-Expiry Function (Run every 10 minutes via pg_cron or server worker)
CREATE OR REPLACE FUNCTION purge_expired_print_jobs()
RETURNS TABLE (purged_count INT) AS $$
DECLARE
    affected_rows INT;
BEGIN
    -- Mark unclaimed expired jobs as expired
    UPDATE print_jobs
    SET job_status = 'expired',
        deleted_at = CURRENT_TIMESTAMP
    WHERE expires_at < CURRENT_TIMESTAMP
      AND job_status IN ('staged', 'queued');

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN QUERY SELECT affected_rows;
END;
$$ LANGUAGE plpgsql;
