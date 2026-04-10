# Telegram Parser

Parse public Telegram channels and repost selected content to your channels with AI rewriting.

## Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL running locally

## Setup

### 1. Telegram API credentials
Go to https://my.telegram.org → API development tools → create app.
Get `api_id` and `api_hash`.

### 2. Telegram Bot
Message @BotFather → /newbot → get token.
Add bot as **admin** to your target channel(s).

### 3. Database
```sql
CREATE DATABASE telegram_parser;
```

### 4. Environment
```bash
cp .env.example .env
# fill in all values
```

### 5. Backend
```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --port 8000
```

### 6. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Usage
1. Log in with your Telegram phone number
2. Add your target channel(s) under "My Channels"
3. Add source channels and link them to your channels
4. Click a source channel → "Fetch Posts"
5. Click a post → "Rewrite with AI" → edit if needed → "Publish"
