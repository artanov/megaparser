import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from sqlalchemy import select

from database import async_session_factory
from models import TelegramSession
from config import get_settings
import telegram_client as tc
from routers import auth, channels, posts, admin

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Try to restore Telethon session from DB on startup
    try:
        async with async_session_factory() as db:
            result = await db.execute(
                select(TelegramSession).where(
                    TelegramSession.user_id == settings.allowed_user_id
                )
            )
            session = result.scalar_one_or_none()
            if session:
                await tc.init_client(
                    session.session_string,
                    settings.telegram_api_id,
                    settings.telegram_api_hash,
                )
    except Exception as e:
        print(f"[startup] Could not restore Telegram session: {e}")

    yield

    await tc.disconnect_client()


app = FastAPI(title="Telegram Parser", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    from fastapi import HTTPException
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"data": None, "error": exc.detail},
        )
    return JSONResponse(
        status_code=500,
        content={"data": None, "error": str(exc)},
    )


# Serve downloaded media files
os.makedirs("media", exist_ok=True)
app.mount("/media", StaticFiles(directory="media"), name="media")

# API routers
app.include_router(auth.router, prefix="/api")
app.include_router(channels.router, prefix="/api")
app.include_router(posts.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
