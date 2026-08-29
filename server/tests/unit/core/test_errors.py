"""Unit tests for core.errors — reusable HTTP error helpers."""

import pytest
from fastapi import HTTPException

from app.core.errors import (
    bad_gateway,
    bad_request,
    forbidden,
    not_found,
    service_unavailable,
    unauthorized,
    unprocessable,
)


@pytest.mark.parametrize(
    ("helper", "expected_status"),
    [
        (not_found, 404),
        (bad_request, 400),
        (unauthorized, 401),
        (forbidden, 403),
    ],
)
def test_error_helper_status_codes(helper, expected_status):
    with pytest.raises(HTTPException) as exc_info:
        raise helper()
    assert exc_info.value.status_code == expected_status


@pytest.mark.parametrize(
    ("helper", "expected_status"),
    [
        (service_unavailable, 503),
        (bad_gateway, 502),
        (unprocessable, 422),
    ],
)
def test_error_helpers_requiring_detail(helper, expected_status):
    exc = helper("detail")
    assert exc.status_code == expected_status
    assert exc.detail == "detail"


@pytest.mark.parametrize("detail", ["Custom message."])
def test_error_helpers_carry_detail(detail):
    for helper in (not_found, bad_request, unauthorized, forbidden, service_unavailable, bad_gateway):
        exc = helper(detail)
        assert exc.detail == detail


def test_unprocessable_requires_detail():
    exc = unprocessable("Provider is required.")
    assert exc.status_code == 422
    assert exc.detail == "Provider is required."


def test_default_details_are_human_readable():
    assert "not found" in not_found().detail.lower()
    assert "authentication" in unauthorized().detail.lower()


def test_errors_are_http_exceptions():
    for helper in (not_found, bad_request, unauthorized, forbidden, unprocessable, service_unavailable, bad_gateway):
        assert isinstance(helper("x"), HTTPException)
