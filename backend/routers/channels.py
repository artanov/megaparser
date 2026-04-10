from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from database import get_db
from models import MyChannel, SourceChannel
from deps import require_auth
import telegram_client as tc

router = APIRouter(prefix="/channels", tags=["channels"])


class AddMyChannelBody(BaseModel):
    username: str


class AddSourceChannelBody(BaseModel):
    url: str
    my_channel_id: int


class PatchSourceChannelBody(BaseModel):
    prompt: str


@router.get("/my")
async def list_my_channels(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    result = await db.execute(select(MyChannel).order_by(MyChannel.created_at))
    channels = result.scalars().all()
    return {"data": jsonable_encoder(channels), "error": None}


@router.post("/my")
async def add_my_channel(
    body: AddMyChannelBody,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    client = await tc.get_client()
    username = body.username.lstrip("@")
    try:
        entity = await client.get_entity(username)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not resolve channel: {e}")

    channel = MyChannel(
        tg_id=entity.id,
        username=username,
        title=getattr(entity, "title", username),
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    return {"data": jsonable_encoder(channel), "error": None}


@router.delete("/my/{channel_id}")
async def delete_my_channel(
    channel_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    result = await db.execute(select(MyChannel).where(MyChannel.id == channel_id))
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    await db.delete(channel)
    await db.commit()
    return {"data": {"ok": True}, "error": None}


@router.get("/sources")
async def list_source_channels(
    my_channel_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    result = await db.execute(
        select(SourceChannel).where(SourceChannel.my_channel_id == my_channel_id)
    )
    channels = result.scalars().all()
    return {"data": jsonable_encoder(channels), "error": None}


@router.post("/sources")
async def add_source_channel(
    body: AddSourceChannelBody,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    username = body.url.rstrip("/").split("/")[-1].lstrip("@")
    client = await tc.get_client()
    try:
        entity = await client.get_entity(username)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not resolve channel: {e}")

    channel = SourceChannel(
        username=username,
        title=getattr(entity, "title", username),
        tg_id=entity.id,
        my_channel_id=body.my_channel_id,
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    return {"data": jsonable_encoder(channel), "error": None}


@router.patch("/sources/{channel_id}")
async def patch_source_channel(
    channel_id: int,
    body: PatchSourceChannelBody,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    result = await db.execute(
        select(SourceChannel).where(SourceChannel.id == channel_id)
    )
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    channel.prompt = body.prompt
    await db.commit()
    await db.refresh(channel)
    return {"data": jsonable_encoder(channel), "error": None}


@router.delete("/sources/{channel_id}")
async def delete_source_channel(
    channel_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    result = await db.execute(
        select(SourceChannel).where(SourceChannel.id == channel_id)
    )
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    await db.delete(channel)
    await db.commit()
    return {"data": {"ok": True}, "error": None}
