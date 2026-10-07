-- The authoritative API now owns records in cbpms_private, created by the
-- server's SQLAlchemy metadata. Do not expose that schema through PostgREST.
-- Preserve all legacy data, but close the prototype's unrestricted access.
BEGIN;
DROP POLICY IF EXISTS "Customers can stage print jobs" ON public.print_jobs;
DROP POLICY IF EXISTS "Jobs viewable by token or shop owner" ON public.print_jobs;
DROP POLICY IF EXISTS "Jobs update allowed" ON public.print_jobs;
REVOKE ALL ON public.print_jobs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.shops, public.printers FROM anon, authenticated;
DROP POLICY IF EXISTS "Allow public staging upload to transient-print-jobs" ON storage.objects;

-- Replace the legacy metadata-only delete function. Binary deletion MUST use
-- Storage API remove(), which the backend cleanup worker now invokes.
CREATE OR REPLACE FUNCTION public.purge_expired_storage_blobs()
RETURNS TABLE (deleted_count INT) AS $$
BEGIN
    RAISE EXCEPTION 'Use the CBPMS cleanup worker and Storage API; SQL deletion only removes metadata';
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.purge_expired_storage_blobs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_expired_print_jobs() FROM PUBLIC;
COMMIT;
