from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import TelegramSession
from config import get_settings


async def require_auth(db: AsyncSession = Depends(get_db)) -> TelegramSession:
    settings = get_settings()
    result = await db.execute(
        select(TelegramSession).where(TelegramSession.user_id == settings.allowed_user_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return session
