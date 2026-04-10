import asyncio
import os
from typing import Optional

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.types import MessageMediaPhoto, MessageMediaDocument

_client: Optional[TelegramClient] = None


async def init_client(session_string: str, api_id: int, api_hash: str) -> None:
    global _client
    if _client and _client.is_connected():
        await _client.disconnect()
    _client = TelegramClient(StringSession(session_string), api_id, api_hash)
    await _client.connect()


async def disconnect_client() -> None:
    global _client
    if _client and _client.is_connected():
        await _client.disconnect()
    _client = None


async def get_client() -> TelegramClient:
    if _client is None or not _client.is_connected():
        raise RuntimeError("Telegram client not initialized")
    return _client


async def fetch_posts(client: TelegramClient, username: str, limit: int = 20):
    messages = await client.get_messages(username, limit=limit)
    return messages


async def download_media(client: TelegramClient, message, save_dir: str) -> list[tuple[str, str]]:
    results = []
    if not message.media:
        return results

    os.makedirs(save_dir, exist_ok=True)

    if isinstance(message.media, MessageMediaPhoto):
        path = await client.download_media(message.media, file=save_dir)
        if path:
            results.append((str(path), "photo"))
    elif isinstance(message.media, MessageMediaDocument):
        doc = message.media.document
        mime = getattr(doc, "mime_type", "") or ""
        if mime.startswith("video"):
            path = await client.download_media(message.media, file=save_dir)
            if path:
                results.append((str(path), "video"))

    await asyncio.sleep(0.3)
    return results
