# Supabase database CA

`supabase-prod-ca-2021.crt` is a public CA certificate used to verify the Supabase database pooler. It contains no private key. It is used by this application's PostgreSQL client and is not installed into the operating system's trust store.

The download URL was verified against Supabase's [official dashboard configuration](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json), whose `ssl:certificate_url` template selects this production certificate:

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Retrieved over HTTPS on 2026-10-08. Subject: `Supabase Root 2021 CA`. PostgreSQL must use `sslmode=verify-full` and point `sslrootcert` to this file. Keep hostname and certificate verification enabled when rotating the CA.
