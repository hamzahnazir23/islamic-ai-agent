import os
from contextlib import contextmanager

import psycopg2
from psycopg2.pool import ThreadedConnectionPool

_pool = None


def _dsn_kwargs():
    url = os.getenv("DATABASE_URL")
    if url:
        return {"dsn": url}
    return {
        "dbname": os.getenv("PGDATABASE", "islamic_ai"),
        "user": os.getenv("PGUSER", "hamzahnazir"),
        "password": os.getenv("PGPASSWORD") or None,
        "host": os.getenv("PGHOST", "localhost"),
        "port": int(os.getenv("PGPORT", "5432")),
    }


def get_pool():
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(
            minconn=1,
            maxconn=int(os.getenv("DB_POOL_MAX", "10")),
            **_dsn_kwargs(),
        )
    return _pool


def reset_pool():
    """Drop the pool so the next call re-reads the environment. Tests use
    this after pointing DATABASE_URL at a scratch database."""
    global _pool
    if _pool is not None:
        try:
            _pool.closeall()
        except Exception:
            pass
        _pool = None


@contextmanager
def db_cursor(commit: bool = False):
    """
    Lease a pooled connection and yield a cursor.

    Rolls back and returns the connection to the pool on any exception, so
    a failed request cannot leave a transaction open and poison the next
    caller that leases the same connection.
    """
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            yield cur
        if commit:
            conn.commit()
        else:
            conn.rollback()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def get_connection():
    """Direct (unpooled) connection, for scripts and long-running jobs."""
    kwargs = _dsn_kwargs()
    if "dsn" in kwargs:
        return psycopg2.connect(kwargs["dsn"])
    return psycopg2.connect(**kwargs)
