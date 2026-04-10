import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import SessionPasswordNeededError

from database import get_db
from models import TelegramSession
from config import get_settings
import telegram_client as tc

router = APIRouter(prefix="/auth", tags=["auth"])

# Temporary store for in-progress login flows (single-user, in-memory is fine)
_pending: dict[str, tuple[str, TelegramClient]] = {}

# QR login state
_qr_state: dict[str, dict] = {}


class SendCodeBody(BaseModel):
    phone: str


class VerifyCodeBody(BaseModel):
    phone: str
    code: str
    phone_code_hash: str


class VerifyPasswordBody(BaseModel):
    phone: str
    password: str


class QrTokenBody(BaseModel):
    token: str


async def _finish_auth(client: TelegramClient, me, phone: str, db: AsyncSession):
    settings = get_settings()

    if me.id != settings.allowed_user_id:
        await client.disconnect()
        if phone in _pending:
            del _pending[phone]
        raise HTTPException(status_code=403, detail="This Telegram account is not allowed")

    session_string = client.session.save()
    await client.disconnect()
    if phone in _pending:
        del _pending[phone]

    await db.execute(delete(TelegramSession))
    session = TelegramSession(
        phone=phone,
        session_string=session_string,
        user_id=me.id,
    )
    db.add(session)
    await db.commit()

    await tc.init_client(session_string, settings.telegram_api_id, settings.telegram_api_hash)

    return {"data": {"user_id": me.id, "first_name": me.first_name}, "error": None}


# ── QR Code Login ────────────────────────────────────────────────

async def _qr_wait_task(token: str, qr_login):
    """Background task that waits for QR scan to complete."""
    try:
        user = await qr_login.wait(timeout=120)
        _qr_state[token]["result"] = "ok"
        _qr_state[token]["user"] = user
    except SessionPasswordNeededError:
        _qr_state[token]["result"] = "need_password"
    except Exception as e:
        _qr_state[token]["result"] = "error"
        _qr_state[token]["error"] = str(e)


@router.post("/qr-init")
async def qr_init():
    """Start QR login flow. Returns a URL to display as QR code."""
    settings = get_settings()
    client = TelegramClient(
        StringSession(), settings.telegram_api_id, settings.telegram_api_hash
    )
    await client.connect()

    qr_login = await client.qr_login()
    token = str(id(client))

    _qr_state[token] = {
        "client": client,
        "qr_login": qr_login,
        "result": None,
    }

    # Start background wait
    asyncio.create_task(_qr_wait_task(token, qr_login))

    return {"data": {"url": qr_login.url, "token": token}, "error": None}


@router.post("/qr-check")
async def qr_check(body: QrTokenBody, db: AsyncSession = Depends(get_db)):
    """Poll this to check if QR was scanned."""
    if body.token not in _qr_state:
        raise HTTPException(status_code=400, detail="No pending QR session")

    state = _qr_state[body.token]
    result = state.get("result")

    if result is None:
        # Still waiting — refresh QR if needed
        qr_login = state["qr_login"]
        try:
            await qr_login.recreate()
            return {"data": {"waiting": True, "url": qr_login.url}, "error": None}
        except Exception:
            return {"data": {"waiting": True}, "error": None}

    if result == "need_password":
        return {"data": {"need_password": True, "token": body.token}, "error": None}

    if result == "error":
        err = state.get("error", "Unknown error")
        client = state["client"]
        del _qr_state[body.token]
        await client.disconnect()
        raise HTTPException(status_code=400, detail=err)

    # result == "ok"
    client = state["client"]
    del _qr_state[body.token]
    me = await client.get_me()
    return await _finish_auth(client, me, f"qr_{me.phone or me.id}", db)


@router.post("/qr-password")
async def qr_password(body: VerifyPasswordBody, db: AsyncSession = Depends(get_db)):
    """Submit 2FA password for QR login flow."""
    # body.phone is repurposed as token here
    token = body.phone
    if token not in _qr_state:
        raise HTTPException(status_code=400, detail="No pending QR session")

    client = _qr_state[token]["client"]

    try:
        me = await client.sign_in(password=body.password)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    del _qr_state[token]
    return await _finish_auth(client, me, f"qr_{me.phone or me.id}", db)


# ── Phone Code Login ─────────────────────────────────────────────

@router.post("/send-code")
async def send_code(body: SendCodeBody):
    settings = get_settings()
    client = TelegramClient(
        StringSession(), settings.telegram_api_id, settings.telegram_api_hash
    )
    await client.connect()
    result = await client.send_code_request(body.phone)
    _pending[body.phone] = (result.phone_code_hash, client)
    return {"data": {"phone_code_hash": result.phone_code_hash}, "error": None}


@router.post("/resend-sms")
async def resend_sms(body: SendCodeBody):
    if body.phone not in _pending:
        raise HTTPException(status_code=400, detail="No pending code — call send-code first")
    _, client = _pending[body.phone]
    try:
        result = await client.send_code_request(body.phone, force_sms=True)
        _pending[body.phone] = (result.phone_code_hash, client)
        return {"data": {"phone_code_hash": result.phone_code_hash, "method": "sms"}, "error": None}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/verify-code")
async def verify_code(body: VerifyCodeBody, db: AsyncSession = Depends(get_db)):
    if body.phone not in _pending:
        raise HTTPException(status_code=400, detail="No pending code for this phone")

    _, client = _pending[body.phone]

    try:
        me = await client.sign_in(
            body.phone, body.code, phone_code_hash=body.phone_code_hash
        )
    except SessionPasswordNeededError:
        return {"data": {"need_password": True}, "error": None}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return await _finish_auth(client, me, body.phone, db)


@router.post("/verify-password")
async def verify_password(body: VerifyPasswordBody, db: AsyncSession = Depends(get_db)):
    if body.phone not in _pending:
        raise HTTPException(status_code=400, detail="No pending session for this phone")

    _, client = _pending[body.phone]

    try:
        me = await client.sign_in(password=body.password)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return await _finish_auth(client, me, body.phone, db)


# ── Status & Logout ──────────────────────────────────────────────

@router.get("/status")
async def auth_status(db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    result = await db.execute(select(TelegramSession))
    session = result.scalar_one_or_none()
    if session and session.user_id == settings.allowed_user_id:
        return {"data": {"authenticated": True, "user_id": session.user_id}, "error": None}
    return {"data": {"authenticated": False, "user_id": None}, "error": None}


@router.post("/logout")
async def logout(db: AsyncSession = Depends(get_db)):
    await db.execute(delete(TelegramSession))
    await db.commit()
    await tc.disconnect_client()
    return {"data": {"ok": True}, "error": None}
