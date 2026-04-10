import os
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from database import get_db
from models import Post, SourceChannel, MyChannel, PublishLog
from deps import require_auth
from config import get_settings
import telegram_client as tc
import bot_publisher
import ai_rewriter

router = APIRouter(prefix="/posts", tags=["posts"])


class PatchPostBody(BaseModel):
    rewritten_text: str


@router.post("/fetch")
async def fetch_posts(
    source_channel_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    result = await db.execute(
        select(SourceChannel).where(SourceChannel.id == source_channel_id)
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source channel not found")

    client = await tc.get_client()
    messages = await tc.fetch_posts(client, source.username, limit=50)

    # Group messages by grouped_id (Telegram albums), ungrouped go solo
    grouped: dict[int, list] = defaultdict(list)
    ungrouped: list = []
    for msg in messages:
        if not msg.text and not msg.media:
            continue
        if msg.grouped_id:
            grouped[msg.grouped_id].append(msg)
        else:
            ungrouped.append(msg)

    # Each "unit" is a list of messages that form one post
    units: list[list] = [[msg] for msg in ungrouped]
    for group_msgs in grouped.values():
        units.append(sorted(group_msgs, key=lambda m: m.id))

    new_posts = []
    for unit in units:
        representative = unit[0]

        existing = await db.execute(
            select(Post).where(
                Post.source_channel_id == source_channel_id,
                Post.message_id == representative.id,
            )
        )
        if existing.scalar_one_or_none():
            continue

        media_paths: list[str] = []
        media_types: list[str] = []
        text = ""

        for msg in unit:
            if msg.text:
                text = msg.text
            if msg.media:
                save_dir = os.path.join("media", str(source_channel_id), str(msg.id))
                results = await tc.download_media(client, msg, save_dir)
                for path, type_ in results:
                    rel = os.path.relpath(path).replace("\\", "/")
                    media_paths.append(rel)
                    media_types.append(type_)

        post = Post(
            source_channel_id=source_channel_id,
            message_id=representative.id,
            original_text=text,
            media_paths=media_paths,
            media_types=media_types,
            status="new",
        )
        db.add(post)
        new_posts.append(post)

    await db.commit()
    for post in new_posts:
        await db.refresh(post)

    return {"data": jsonable_encoder(new_posts), "error": None}


@router.get("")
async def list_posts(
    source_channel_id: int,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    query = select(Post).where(Post.source_channel_id == source_channel_id)
    if status:
        query = query.where(Post.status == status)
    query = query.order_by(Post.created_at.desc())

    result = await db.execute(query)
    posts = result.scalars().all()
    return {"data": jsonable_encoder(posts), "error": None}


@router.post("/{post_id}/rewrite")
async def rewrite_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    settings = get_settings()
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if not post.original_text:
        raise HTTPException(status_code=400, detail="Post has no text to rewrite")

    src_result = await db.execute(
        select(SourceChannel).where(SourceChannel.id == post.source_channel_id)
    )
    source = src_result.scalar_one_or_none()
    channel_prompt = source.prompt if source else None

    rewritten = await ai_rewriter.rewrite_post(
        post.original_text, settings.openai_api_key, prompt=channel_prompt
    )
    post.rewritten_text = rewritten
    post.status = "ready"
    await db.commit()

    return {"data": {"rewritten_text": rewritten}, "error": None}


@router.patch("/{post_id}")
async def patch_post(
    post_id: int,
    body: PatchPostBody,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    post.rewritten_text = body.rewritten_text
    if post.status == "new":
        post.status = "ready"
    await db.commit()
    await db.refresh(post)

    return {"data": jsonable_encoder(post), "error": None}


@router.post("/{post_id}/publish")
async def publish_post(
    post_id: int,
    target_channel_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    settings = get_settings()

    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    result = await db.execute(select(MyChannel).where(MyChannel.id == target_channel_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Target channel not found")

    result = await db.execute(
        select(SourceChannel).where(SourceChannel.id == post.source_channel_id)
    )
    source = result.scalar_one_or_none()

    text = post.rewritten_text or post.original_text
    channel_tg_id = f"-100{target.tg_id}"

    try:
        await bot_publisher.publish_post(
            channel_tg_id=channel_tg_id,
            text=text,
            media_paths=post.media_paths or [],
            media_types=post.media_types or [],
            bot_token=settings.telegram_bot_token,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Telegram Bot API error: {e}")

    sent_at = datetime.utcnow()
    post.status = "sent"
    post.sent_at = sent_at
    post.target_channel_id = target_channel_id

    log = PublishLog(
        post_id=post.id,
        source_channel_username=source.username if source else "",
        target_channel_username=target.username,
        original_text_snippet=(post.original_text or "")[:300],
        rewritten_text_snippet=(post.rewritten_text or "")[:300] or None,
        media_count=len(post.media_paths or []),
        published_at=sent_at,
    )
    db.add(log)
    await db.commit()

    return {"data": {"sent_at": sent_at.isoformat()}, "error": None}


@router.post("/{post_id}/discard")
async def discard_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    post.status = "discarded"
    await db.commit()

    return {"data": {"ok": True}, "error": None}
