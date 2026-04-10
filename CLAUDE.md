# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Single-user, self-hosted web service: parse public Telegram channels, AI-rewrite posts, publish to your own channels via Bot API.

## Dev Commands

### Backend
```bash
cd backend
pip install -r requirements.txt
alembic upgrade head                          # run migrations
uvicorn main:app --reload --port 8000         # dev server
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build
npm run lint
```

### Database
```sql
CREATE DATABASE telegram_parser;
```

## Architecture

**Backend** — FastAPI + asyncpg (SQLAlchemy async). All routes under `/api`, all responses `{ "data": ..., "error": null }`.

Three external integrations live in dedicated modules:
- `telegram_client.py` — singleton Telethon client (MTProto, StringSession stored in DB). Used for parsing source channels and downloading media.
- `bot_publisher.py` — raw httpx calls to Bot API (no library). Handles sendMessage / sendPhoto / sendVideo / sendMediaGroup depending on media count.
- `ai_rewriter.py` — OpenAI `gpt-4o`, async, max_tokens 1000.

Auth is session-based: phone → code → StringSession saved to `telegram_sessions` table. Every non-auth endpoint checks that a session exists with `user_id == ALLOWED_USER_ID` (from `.env`), returns 401 otherwise.

Media files are downloaded to `backend/media/{source_channel_id}/{message_id}/` and served via FastAPI StaticFiles at `/media/...`.

**Routers:** `auth.py`, `channels.py` (my channels + source channels), `posts.py`, `admin.py`.

**Frontend** — React 18 + Vite + TypeScript. Single axios client in `api/client.ts`. Three pages: `Login`, `Dashboard`, `Admin` (`/admin`). `Dashboard` has a fixed 240px sidebar (channel tree) + main post grid. `PostEditor` is a full-screen overlay with original/rewritten two-column layout.

**Database models:** `TelegramSession`, `MyChannel` (target), `SourceChannel` (→ MyChannel FK), `Post` (status: new→ready→sent|discarded), `PublishLog`.

## Environment Variables

Copy `.env.example` to `.env`:
- `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` — from https://my.telegram.org
- `TELEGRAM_BOT_TOKEN` — bot must be admin in all target channels
- `OPENAI_API_KEY`
- `DATABASE_URL` — `postgresql+asyncpg://...`
- `ALLOWED_USER_ID` — numeric Telegram user ID allowed to log in

## Frontend Style

Fragment.com aesthetic — dark, monospace, no rounded corners (max 2px), no shadows/gradients, yellow accent `#e8ff57`. CSS variables only, no Tailwind or UI kit. Fonts: JetBrains Mono (labels, badges) + DM Sans (body).

Status badge colors: NEW=accent, READY=#4488ff, SENT=#44ff88, DISCARDED=muted.

## Key Implementation Notes

- `bot_publisher.py`: channel IDs use `-100` prefix (e.g. `-1001234567890`)
- Media download: `asyncio.sleep(0.3)` between files to avoid flood
- `sendMediaGroup`: caption only on the first item
- CORS: allow `http://localhost:5173`
- Alembic config in `backend/alembic.ini`
