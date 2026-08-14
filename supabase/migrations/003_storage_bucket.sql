-- Migration: 003_storage_bucket.sql
-- Description: Create private Supabase Storage bucket for ephemeral print files and set RLS policies

-- 1. Insert bucket definition into storage.buckets if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'transient-print-jobs',
    'transient-print-jobs',
    FALSE, -- Private bucket: access requires short-lived pre-signed URLs
    26214400, -- 25MB file size ceiling (25 * 1024 * 1024 bytes)
    ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = FALSE,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png'
    ];

-- 2. Storage RLS Policies
-- Allow backend service role key full access to insert, select, and delete
CREATE POLICY "Service Role full access on transient-print-jobs"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'transient-print-jobs')
WITH CHECK (bucket_id = 'transient-print-jobs');

-- Allow authenticated and anon users to upload if matching staged format
CREATE POLICY "Allow public staging upload to transient-print-jobs"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'transient-print-jobs');

-- Procedural Cleanup for Storage Objects older than 2 hours
CREATE OR REPLACE FUNCTION purge_expired_storage_blobs()
RETURNS TABLE (deleted_count INT) AS $$
DECLARE
    purged_rows INT;
BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = 'transient-print-jobs'
      AND created_at < (CURRENT_TIMESTAMP - INTERVAL '2 hours');
      
    GET DIAGNOSTICS purged_rows = ROW_COUNT;
    RETURN QUERY SELECT purged_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
