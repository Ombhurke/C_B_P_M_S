"""Durable, server-only records. All read/modify/write transactions are serialized.

SQLite is for a single local server. PostgreSQL uses a transaction advisory lock;
the private schema is deliberately not exposed through Supabase's public API.
"""
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import Column, JSON, MetaData, String, Table, create_engine, select, text
from sqlalchemy.engine import make_url

from app.core.config import settings


class Records:
    def __init__(self, connection, tables):
        self.connection, self.tables = connection, tables

    def get(self, kind, key):
        table = self.tables[kind]
        return self.connection.execute(select(table.c.data).where(table.c.id == key)).scalar_one_or_none()

    def list(self, kind):
        return list(self.connection.execute(select(self.tables[kind].c.data)).scalars())

    def put(self, kind, key, data):
        table = self.tables[kind]
        existing = self.connection.execute(select(table.c.id).where(table.c.id == key)).first()
        if existing:
            self.connection.execute(table.update().where(table.c.id == key).values(data=data))
        else:
            self.connection.execute(table.insert().values(id=key, data=data))

    def remove(self, kind, key):
        table = self.tables[kind]
        self.connection.execute(table.delete().where(table.c.id == key))


class Database:
    def __init__(self):
        self.engine = None

    def initialize(self, url=None):
        url = url or settings.DATABASE_URL
        parsed = make_url(url)
        if parsed.get_backend_name() not in ("sqlite", "postgresql"):
            raise ValueError("DATABASE_URL must use SQLite or PostgreSQL")
        self.postgres = parsed.get_backend_name() == "postgresql"
        if settings.ENVIRONMENT != "test" and not self.postgres:
            raise ValueError("PostgreSQL is required outside automated tests")
        if settings.ENVIRONMENT != "test" and parsed.query.get("sslmode") != "verify-full":
            raise ValueError("Production database connections require sslmode=verify-full")
        if self.postgres:
            bundled_cert = Path(__file__).resolve().parents[2] / "certs" / "supabase-prod-ca-2021.crt"
            query = dict(parsed.query)
            sslrootcert = query.get("sslrootcert")
            # If sslrootcert is missing or points to a non-existent path on this machine/container:
            if not sslrootcert or not Path(sslrootcert).exists():
                if bundled_cert.exists():
                    query["sslrootcert"] = str(bundled_cert.resolve())
                else:
                    query["sslrootcert"] = "system"
                parsed = parsed.set(query=query)
                url = parsed.render_as_string(hide_password=False)
        if not self.postgres and parsed.database not in (None, ":memory:"):
            Path(parsed.database).parent.mkdir(parents=True, exist_ok=True)
        self.engine = create_engine(url, pool_pre_ping=True, **(
            {} if self.postgres else {"connect_args": {"check_same_thread": False, "timeout": 30}}
        ))
        self.metadata = MetaData(schema="cbpms_private" if self.postgres else None)
        self.tables = {
            kind: Table(kind, self.metadata, Column("id", String(128), primary_key=True),
                        Column("data", JSON, nullable=False))
            for kind in ("shops", "jobs", "users", "sessions", "attempts", "documents", "audit_events")
        }
        with self.engine.begin() as conn:
            if self.postgres:
                conn.execute(text("CREATE SCHEMA IF NOT EXISTS cbpms_private"))
                conn.execute(text("REVOKE ALL ON SCHEMA cbpms_private FROM PUBLIC"))
            self.metadata.create_all(conn)
            if self.postgres:
                for role in ("PUBLIC", "anon", "authenticated"):
                    conn.execute(text(f"REVOKE ALL ON SCHEMA cbpms_private FROM {role}"))
                    conn.execute(text(f"REVOKE ALL ON ALL TABLES IN SCHEMA cbpms_private FROM {role}"))
                for kind in self.tables:
                    conn.execute(text(f"ALTER TABLE cbpms_private.{kind} ENABLE ROW LEVEL SECURITY"))

    @contextmanager
    def transaction(self, readonly: bool = False):
        if self.engine is None:
            raise RuntimeError("Database is not initialized; start the application's lifespan")
        with self.engine.connect() as conn:
            if self.postgres:
                conn.begin()
                if readonly:
                    conn.execute(text("SELECT pg_advisory_xact_lock_shared(728491036)"))
                else:
                    conn.execute(text("SELECT pg_advisory_xact_lock(728491036)"))
            else:
                conn.exec_driver_sql("BEGIN IMMEDIATE" if not readonly else "BEGIN")
            try:
                yield Records(conn, self.tables)
                conn.commit()
            except BaseException:
                conn.rollback()
                raise

    def close(self):
        if self.engine:
            self.engine.dispose()
        self.engine = None


db = Database()
