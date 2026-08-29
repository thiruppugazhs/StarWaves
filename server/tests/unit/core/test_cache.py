"""Unit tests for core.cache — local LRU fallback behavior (Redis path mocked off)."""

import pytest

from app.core import cache


@pytest.fixture(autouse=True)
def _local_only(monkeypatch):
    """Force the in-memory path and reset cache state around each test."""
    monkeypatch.setattr(cache, "_get_redis", lambda: None)
    cache._local_cache.clear()
    yield
    cache._local_cache.clear()


class TestCacheGetSet:
    def test_set_then_get_round_trip(self):
        cache.cache_set("k", {"a": 1}, ttl=60)
        assert cache.cache_get("k") == {"a": 1}

    def test_get_missing_returns_none(self):
        assert cache.cache_get("nope") is None

    def test_expired_entry_returns_none(self, monkeypatch):
        cache.cache_set("k", "v", ttl=1)
        real_monotonic = cache._time.monotonic
        monkeypatch.setattr(cache._time, "monotonic", lambda: real_monotonic() + 10)
        assert cache.cache_get("k") is None

    def test_expired_entry_is_evicted(self, monkeypatch):
        cache.cache_set("k", "v", ttl=1)
        real_monotonic = cache._time.monotonic
        monkeypatch.setattr(cache._time, "monotonic", lambda: real_monotonic() + 10)
        cache.cache_get("k")
        assert "k" not in cache._local_cache

    def test_unexpired_entry_still_readable(self):
        cache.cache_set("k", 42, ttl=100)
        assert cache.cache_get("k") == 42


class TestCacheDelete:
    def test_delete_removes_entry(self):
        cache.cache_set("k", "v", ttl=60)
        cache.cache_delete("k")
        assert cache.cache_get("k") is None

    def test_delete_missing_key_is_noop(self):
        cache.cache_delete("never-set")


class TestLruBound:
    def test_oldest_entry_evicted_at_capacity(self):
        for i in range(cache._MAX_LOCAL):
            cache.cache_set(f"k{i}", i, ttl=60)
        # capacity reached: inserting one more evicts the oldest key
        cache.cache_set("overflow", "x", ttl=60)
        keys = set(cache._local_cache.keys())
        assert "overflow" in keys
        assert "k0" not in keys
        assert len(keys) <= cache._MAX_LOCAL


class TestInvalidatePrefix:
    def test_only_matching_prefixes_removed(self):
        cache.cache_set("eve:mem:user-1", 1, ttl=60)
        cache.cache_set("eve:mem:user-2", 2, ttl=60)
        cache.cache_set("other:key", 3, ttl=60)

        cache.cache_invalidate_prefix("eve:mem:")

        assert cache.cache_get("eve:mem:user-1") is None
        assert cache.cache_get("eve:mem:user-2") is None
        assert cache.cache_get("other:key") == 3
