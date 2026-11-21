import httpx
import pytest

from app.push import send_expo_push


async def test_send_expo_push_noop_without_token():
    # Empty token: must return without attempting a network call.
    await send_expo_push("", "title", "body")


async def test_send_expo_push_posts_payload(monkeypatch):
    captured = {}

    async def fake_post(self, url, json):
        captured["url"] = url
        captured["json"] = json
        return httpx.Response(200, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    await send_expo_push("tok123", "Missed dose", "body text")

    assert captured["json"] == {"to": "tok123", "title": "Missed dose", "body": "body text"}


async def test_send_expo_push_swallows_http_errors(monkeypatch):
    async def fake_post(self, url, json):
        raise httpx.ConnectError("boom")

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    await send_expo_push("tok123", "title", "body")  # must not raise
