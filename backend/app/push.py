import httpx

from app.config import EXPO_PUSH_URL


async def send_expo_push(token: str, title: str, body: str) -> None:
    if not token:
        return
    payload = {"to": token, "title": title, "body": body}
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            await client.post(EXPO_PUSH_URL, json=payload)
        except httpx.HTTPError:
            pass
