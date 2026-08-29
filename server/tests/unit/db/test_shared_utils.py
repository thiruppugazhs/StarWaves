"""Unit tests for db.sql._shared coercion utilities."""

from datetime import datetime, timezone

from app.db.sql._shared import (
    SERVER_TIMESTAMP,
    ArrayUnion,
    clean_data,
    coerce_model_value,
    is_array_union,
    is_server_timestamp,
    json_safe,
    utc_now_iso,
)


class TestServerTimestampDetection:
    def test_sentinel_detected(self):
        assert is_server_timestamp(SERVER_TIMESTAMP) is True

    def test_placeholder_prefix_detected(self):
        assert is_server_timestamp("__SQL_SERVER_TIMESTAMP__x") is True

    def test_firebase_sentinel_duck_typed(self):
        class Sentinel:
            pass

        assert is_server_timestamp(Sentinel()) is True

    def test_regular_values_not_detected(self):
        assert is_server_timestamp(None) is False
        assert is_server_timestamp("2026-01-01T00:00:00+00:00") is False
        assert is_server_timestamp(123) is False


class TestArrayUnionCompat:
    def test_native_array_union_detected(self):
        assert is_array_union(ArrayUnion([1, 2])) is True

    def test_firebase_admin_array_union_same_name_detected(self):
        """firebase_admin's class is also named ``ArrayUnion`` — name-based check accepts it."""
        class ArrayUnion:  # mimics firebase_admin.firestore.ArrayUnion
            def __init__(self):
                self.values = [1]

        assert is_array_union(ArrayUnion()) is True

    def test_plain_list_not_detected(self):
        assert is_array_union([1, 2]) is False


class TestCoerceModelValue:
    def test_server_timestamp_becomes_now_datetime(self):
        before = datetime.now(timezone.utc)
        coerced = coerce_model_value("created_at", SERVER_TIMESTAMP)
        assert isinstance(coerced, datetime)
        assert coerced >= before.replace(microsecond=0)

    def test_iso_string_parsed_for_timestamp_keys(self):
        coerced = coerce_model_value("updated_at", "2026-08-25T10:00:00+00:00")
        assert isinstance(coerced, datetime)
        assert coerced.year == 2026

    def test_z_suffix_iso_parsed(self):
        coerced = coerce_model_value("timestamp", "2026-08-25T10:00:00Z")
        assert isinstance(coerced, datetime)

    def test_invalid_iso_falls_back_to_now(self):
        coerced = coerce_model_value("deadline", "not-a-date")
        assert isinstance(coerced, datetime)

    def test_non_timestamp_keys_passthrough(self):
        assert coerce_model_value("title", "hello") == "hello"

    def test_none_passthrough(self):
        assert coerce_model_value("title", None) is None


class TestJsonSafe:
    def test_datetime_converted_to_iso(self):
        dt = datetime(2026, 8, 25, tzinfo=timezone.utc)
        assert json_safe(dt) == "2026-08-25T00:00:00+00:00"

    def test_nested_structures(self):
        payload = {"a": [datetime(2026, 1, 1), {"b": datetime(2026, 2, 2)}]}
        result = json_safe(payload)
        assert all(isinstance(v, str) for v in [result["a"][0], result["a"][1]["b"]])

    def test_primitives_passthrough(self):
        assert json_safe({"n": 1, "s": "x", "f": 1.5}) == {"n": 1, "s": "x", "f": 1.5}


class TestCleanData:
    def test_server_timestamp_replaced_by_datetime_for_timestamp_keys(self):
        cleaned = clean_data({"created_at": SERVER_TIMESTAMP})
        assert isinstance(cleaned["created_at"], datetime)

    def test_server_timestamp_replaced_by_iso_for_other_keys(self):
        cleaned = clean_data({"misc": SERVER_TIMESTAMP})
        assert isinstance(cleaned["misc"], str)

    def test_array_union_unwrapped(self):
        cleaned = clean_data({"tags": ArrayUnion(["a", "b"])})
        assert cleaned["tags"] == ["a", "b"]

    def test_plain_values_untouched(self):
        source = {"name": "x", "count": 3}
        assert clean_data(source) == source


def test_utc_now_iso_format():
    parsed = datetime.fromisoformat(utc_now_iso())
    assert parsed.tzinfo is not None
