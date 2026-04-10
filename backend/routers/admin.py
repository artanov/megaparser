from fastapi import APIRouter, Depends
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from database import get_db
from models import PublishLog, Post
from deps import require_auth

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/logs")
async def get_logs(
    from_: str | None = None,
    to: str | None = None,
    source_channel: str | None = None,
    target_channel: str | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    query = select(PublishLog).order_by(PublishLog.published_at.desc()).limit(100)

    if from_:
        from datetime import datetime
        query = query.where(PublishLog.published_at >= datetime.fromisoformat(from_))
    if to:
        from datetime import datetime
        query = query.where(PublishLog.published_at <= datetime.fromisoformat(to))
    if source_channel:
        query = query.where(PublishLog.source_channel_username.ilike(f"%{source_channel}%"))
    if target_channel:
        query = query.where(PublishLog.target_channel_username.ilike(f"%{target_channel}%"))

    result = await db.execute(query)
    logs = result.scalars().all()
    return {"data": jsonable_encoder(logs), "error": None}


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    total_parsed = await db.scalar(select(func.count(Post.id)))
    total_sent = await db.scalar(
        select(func.count(Post.id)).where(Post.status == "sent")
    )
    total_discarded = await db.scalar(
        select(func.count(Post.id)).where(Post.status == "discarded")
    )

    return {
        "data": {
            "total_parsed": total_parsed or 0,
            "total_sent": total_sent or 0,
            "total_discarded": total_discarded or 0,
        },
        "error": None,
    }
