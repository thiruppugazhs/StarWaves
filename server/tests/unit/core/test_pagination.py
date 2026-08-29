"""Unit tests for core.pagination — cursor + limit primitives."""

import base64

import pytest
from pydantic import BaseModel

from app.core.pagination import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    PageResponse,
    decode_cursor,
    encode_cursor,
    resolve_limit,
)


class TestResolveLimit:
    def test_none_returns_default(self):
        assert resolve_limit(None) == DEFAULT_PAGE_SIZE

    def test_custom_default(self):
        assert resolve_limit(None, default=7) == 7

    def test_valid_limit_passthrough(self):
        assert resolve_limit(10) == 10

    def test_zero_clamped_to_one(self):
        assert resolve_limit(0) == 1

    def test_negative_clamped_to_one(self):
        assert resolve_limit(-5) == 1

    def test_above_max_clamped(self):
        assert resolve_limit(5000) == MAX_PAGE_SIZE

    def test_string_limit_coerced(self):
        assert resolve_limit("25") == 25


class TestCursorRoundTrip:
    @pytest.mark.parametrize(
        "doc_id",
        ["job-123", "uuid-with-dashes-4f2c", "emoji-🙂-id", "a" * 300],
    )
    def test_encode_decode_round_trip(self, doc_id):
        assert decode_cursor(encode_cursor(doc_id)) == doc_id

    def test_empty_cursor_encodes_to_empty_and_decodes_to_none(self):
        assert encode_cursor("") == ""
        # decode treats falsy cursors as absent
        assert decode_cursor("") is None

    def test_cursor_is_url_safe(self):
        encoded = encode_cursor("abc/def+ghi==")
        assert "/" not in encoded
        assert "+" not in encoded

    def test_decode_none_returns_none(self):
        assert decode_cursor(None) is None

    def test_decode_empty_returns_none(self):
        assert decode_cursor("") is None

    def test_decode_invalid_raises_value_error(self):
        with pytest.raises(ValueError, match="cursor"):
            decode_cursor("!!!not-base64!!!")

    def test_encoded_matches_expected_base64(self):
        expected = base64.urlsafe_b64encode("doc-9".encode()).decode()
        assert encode_cursor("doc-9") == expected


class TestPageResponse:
    def test_defaults(self):
        page = PageResponse[BaseModel](items=[])
        assert page.items == []
        assert page.next_cursor is None
        assert page.has_more is False

    def test_full_page(self):
        class Item(BaseModel):
            name: str

        page = PageResponse(items=[Item(name="a")], next_cursor="cur", has_more=True)
        assert page.items[0].name == "a"
        assert page.next_cursor == "cur"
        assert page.has_more is True
