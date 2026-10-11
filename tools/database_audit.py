"""Read-only production inventory; optional rollback probe uses TEMP tables only.

Run from the repository root: python tools/database_audit.py --rollback-probe
Never imports the application lifespan or runs Database.initialize().
No customer values, credentials, tokens or connection URLs enter the report.
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import Column, JSON, MetaData, String, Table, create_engine, text, null
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "server"))
from app.core.config import settings
from app.core.database import Database

KINDS = ("shops", "jobs", "users", "sessions", "attempts", "documents", "audit_events")


def rows(conn, query, params=None):
    return [dict(row) for row in conn.execute(text(query), params or {}).mappings()]


def inventory(engine):
    with engine.connect() as conn:
        conn.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"))
        result = {
            "isolation": conn.execute(text("SHOW transaction_isolation")).scalar(),
            "tables": rows(conn, """
                SELECT c.relname AS name, c.relrowsecurity AS rls,
                       c.relforcerowsecurity AS force_rls, r.rolname AS owner
                FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
                JOIN pg_roles r ON r.oid=c.relowner
                WHERE n.nspname='cbpms_private' AND c.relkind='r' ORDER BY c.relname
            """),
            "columns": rows(conn, """
                SELECT table_name, column_name, data_type, is_nullable
                FROM information_schema.columns WHERE table_schema='cbpms_private'
                ORDER BY table_name, ordinal_position
            """),
            "constraints": rows(conn, """
                SELECT c.relname AS table_name, co.conname AS name, co.contype AS type,
                       pg_get_constraintdef(co.oid) AS definition
                FROM pg_constraint co JOIN pg_class c ON co.conrelid=c.oid
                JOIN pg_namespace n ON c.relnamespace=n.oid
                WHERE n.nspname='cbpms_private' ORDER BY c.relname, co.conname
            """),
            "indexes": rows(conn, """
                SELECT tablename, indexname, indexdef FROM pg_indexes
                WHERE schemaname='cbpms_private' ORDER BY tablename, indexname
            """),
            "triggers": rows(conn, """
                SELECT c.relname AS table_name, t.tgname AS name,
                       pg_get_triggerdef(t.oid) AS definition
                FROM pg_trigger t JOIN pg_class c ON t.tgrelid=c.oid
                JOIN pg_namespace n ON c.relnamespace=n.oid
                WHERE n.nspname='cbpms_private' AND NOT t.tgisinternal
            """),
            "runtime_role": rows(conn, """
                SELECT rolname, rolsuper, rolbypassrls,
                       has_schema_privilege(current_user,'cbpms_private','CREATE') AS can_create
                FROM pg_roles WHERE rolname=current_user
            """),
            "browser_access": rows(conn, """
                SELECT rolname, has_schema_privilege(rolname,'cbpms_private','USAGE') AS schema_usage,
                    EXISTS (SELECT 1 FROM pg_tables t WHERE schemaname='cbpms_private'
                      AND has_table_privilege(rolname, format('%I.%I',schemaname,tablename),
                                              'SELECT,INSERT,UPDATE,DELETE')) AS any_table_access
                FROM pg_roles WHERE rolname IN ('anon','authenticated') ORDER BY rolname
            """),
            "legacy_public_tables": rows(conn, """
                SELECT tablename FROM pg_tables WHERE schemaname='public'
                  AND tablename IN ('shops','printers','print_jobs') ORDER BY tablename
            """),
        }
        names = {row['name'] for row in result['tables']}
        result['missing_tables'] = sorted(set(KINDS) - names)
        result['counts'] = {name: conn.execute(text(f'SELECT count(*) FROM cbpms_private.{name}')).scalar()
                            for name in KINDS if name in names}
        result['storage_bucket'] = rows(conn, """
            SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id=:bucket
        """, {'bucket': settings.SUPABASE_STORAGE_BUCKET})
        result['storage_object_count'] = conn.execute(text(
            'SELECT count(*) FROM storage.objects WHERE bucket_id=:bucket'),
            {'bucket': settings.SUPABASE_STORAGE_BUCKET}).scalar()
        if not result['missing_tables']:
            result['consistency_counts'] = rows(conn, """
                SELECT
                  (SELECT count(*) FROM cbpms_private.jobs j LEFT JOIN cbpms_private.shops s
                    ON s.id=j.data->>'shop_id' WHERE s.id IS NULL) AS jobs_without_shop,
                  (SELECT count(*) FROM cbpms_private.documents d LEFT JOIN cbpms_private.jobs j
                    ON j.id=d.data->>'job_id' WHERE j.id IS NULL) AS documents_without_job,
                  (SELECT count(*) FROM cbpms_private.documents d LEFT JOIN cbpms_private.users u
                    ON u.data->>'id'=d.data->>'owner_id'
                    WHERE d.data->>'owner_id' IS NOT NULL AND u.id IS NULL) AS documents_without_owner,
                  (SELECT count(*) FROM cbpms_private.jobs j LEFT JOIN cbpms_private.documents d
                    ON d.id=j.data->>'document_id'
                    WHERE j.data->>'job_status' IN ('staged','queued','processing','failed')
                      AND d.id IS NULL) AS active_jobs_without_document,
                  (SELECT count(*) FROM cbpms_private.documents d JOIN cbpms_private.jobs j
                    ON j.id=d.data->>'job_id'
                    WHERE d.data->>'owner_id' IS DISTINCT FROM j.data->>'owner_id') AS owner_mismatches,
                  (SELECT count(*) FROM cbpms_private.jobs j
                    WHERE j.data->>'job_status' IN ('queued','processing','completed')
                      AND j.data->>'payment_status' IS DISTINCT FROM 'completed') AS unpaid_released_jobs,
                  (SELECT count(*) FROM cbpms_private.documents d WHERE
                    d.data->>'library'='true' AND (d.data->>'access_mode' IS DISTINCT FROM 'account'
                    OR d.data->>'owner_id' IS NULL)) AS invalid_library_ownership
            """)[0]
        conn.rollback()
        return result


def rollback_probe(engine):
    """Exercise the actual adapter against session-local tables, never live rows."""
    adapter = Database()
    adapter.engine, adapter.postgres = engine, True
    metadata = MetaData(schema='pg_temp')
    prefix = 'cbpms_probe_' + uuid4().hex
    adapter.tables = {kind: Table(prefix + '_' + kind, metadata,
                         Column('id', String(128), primary_key=True), Column('data', JSON, nullable=False))
                      for kind in ('jobs', 'documents', 'audit_events')}
    # The engine has exactly one pooled connection, so TEMP tables stay session-local.
    with engine.begin() as conn:
        for table in adapter.tables.values():
            conn.execute(text(f'CREATE TEMP TABLE {table.name} (id varchar(128) PRIMARY KEY, data json NOT NULL)'))
    try:
        with adapter.transaction() as records:
            records.put('jobs', 'existing', {'state': 'staged'})
        caught = False
        try:
            with adapter.transaction() as records:
                records.put('jobs', 'existing', {'state': 'queued'})
                records.put('documents', 'new', {'state': 'available'})
                # A real PostgreSQL constraint error after two successful writes.
                records.connection.execute(adapter.tables['audit_events'].insert().values(id='bad', data=null()))
        except IntegrityError:
            caught = True
        with adapter.transaction() as records:
            restored = records.get('jobs', 'existing') == {'state': 'staged'}
            absent = records.get('documents', 'new') is None and records.get('audit_events', 'bad') is None
            records.put('jobs', 'after_failure', {'state': 'usable'})
        with adapter.transaction() as records:
            recovered = records.get('jobs', 'after_failure') == {'state': 'usable'}
        assert caught and restored and absent and recovered
        return {'passed': True, 'scope': 'session-local TEMP tables using Database.transaction',
                'earlier_update_rolled_back': restored, 'earlier_inserts_rolled_back': absent,
                'connection_usable_after_rollback': recovered,
                'application_rows_modified': False, 'automatic_retry_tested': False}
    finally:
        with engine.begin() as conn:
            for table in adapter.tables.values():
                conn.execute(text(f'DROP TABLE IF EXISTS pg_temp.{table.name}'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rollback-probe', action='store_true')
    args = parser.parse_args()
    url = make_url(settings.DATABASE_URL)
    if url.get_backend_name() != 'postgresql' or url.query.get('sslmode') != 'verify-full':
        raise SystemExit('Audit requires PostgreSQL with full TLS identity verification.')
    engine = create_engine(url, pool_size=1, max_overflow=0, pool_pre_ping=True,
                           connect_args={'connect_timeout': 8, 'options': '-c statement_timeout=15000 -c lock_timeout=3000'},
                           hide_parameters=True)
    report = {'checked_at_utc': datetime.now(timezone.utc).isoformat(),
              'configuration': {'environment': settings.ENVIRONMENT,
                 'tls_verify_full': True, 'storage_service_key_present': bool(settings.SUPABASE_SERVICE_ROLE_KEY),
                 'auth_publishable_key_present': bool(settings.SUPABASE_PUBLISHABLE_KEY),
                 'payment_provider': settings.PAYMENT_PROVIDER,
                 'local_storage_allowed': settings.ALLOW_LOCAL_STORAGE,
                 'demo_seeding': settings.SEED_DEMO_SHOPS}}
    try:
        report['database'] = inventory(engine)
        if args.rollback_probe:
            report['rollback_probe'] = rollback_probe(engine)
    except Exception as exc:
        # Never print SQLAlchemy exceptions: their SQL/parameters may contain data.
        original = getattr(exc, 'orig', None)
        print(json.dumps({'audit_failed': type(exc).__name__, 'sqlstate': getattr(original, 'sqlstate', None)}))
        raise SystemExit(1) from None
    finally:
        engine.dispose()
    output = ROOT / 'output' / 'audits' / 'database-audit-2026-10-09.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, default=str) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2, default=str))
    print('Report:', output)


if __name__ == '__main__':
    main()
