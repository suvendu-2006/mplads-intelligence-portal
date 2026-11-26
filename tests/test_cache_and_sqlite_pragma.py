import sqlite3
from webapi.data_service import set_sqlite_pragma
from webapi.cache_manager import invalidate_all_aggregates
from webapi.routers import states, constituencies, national
from webapi import aggregators


def test_sqlite_pragma_sets_query_only_on_vercel(monkeypatch):
    """Ensure set_sqlite_pragma runs cleanly with os imported and enables query_only under VERCEL."""
    monkeypatch.setenv("VERCEL", "1")
    conn = sqlite3.connect(":memory:")
    try:
        set_sqlite_pragma(conn, None)
        cur = conn.cursor()
        query_only = cur.execute("PRAGMA query_only;").fetchone()[0]
        cur.close()
        assert query_only == 1
    finally:
        conn.close()


def test_invalidate_all_aggregates_clears_state_detail_and_national():
    """Verify cache invalidation clears state detail, constituency, national analytics, and aggregator caches."""
    states._state_detail_cache["__dummy__"] = object()  # type: ignore[assignment]
    constituencies._constituency_cache["__dummy__"] = {"ok": True}
    national._cached_analytics = {"ok": True}
    aggregators._CACHE["__dummy__"] = 1

    invalidate_all_aggregates()

    assert "__dummy__" not in states._state_detail_cache
    assert "__dummy__" not in constituencies._constituency_cache
    assert national._cached_analytics is None
    assert "__dummy__" not in aggregators._CACHE
