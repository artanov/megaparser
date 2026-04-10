#!/bin/bash
# Run this on the server after git pull.
# First deploy: see README for initial setup steps.
set -e

REPO=/var/www/megaparser

echo "==> Pulling latest code"
cd $REPO
git pull

echo "==> Installing Python deps"
source $REPO/venv/bin/activate
pip install -r backend/requirements.txt -q

echo "==> Running migrations"
cd $REPO/backend
alembic upgrade head

echo "==> Building frontend"
cd $REPO/frontend
npm ci --silent
npm run build

echo "==> Restarting backend service"
sudo systemctl restart megaparser

echo "==> Done. Status:"
sudo systemctl status megaparser --no-pager
