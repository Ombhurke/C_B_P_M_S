-- Customer-owned library records and append-only security events.
-- Binary content remains in the private Storage bucket; these tables are not exposed through PostgREST.
create schema if not exists cbpms_private;

create table if not exists cbpms_private.documents (
  id text primary key,
  data jsonb not null
);

create table if not exists cbpms_private.audit_events (
  id text primary key,
  data jsonb not null
);

revoke all on table cbpms_private.documents from public;
revoke all on table cbpms_private.audit_events from public;
