#!/usr/bin/env bash
set -e

echo "=== Pulling latest changes from GitHub ==="
cd /var/www/performance-app
git pull origin main

echo "=== Building Frontend ==="
cd /var/www/performance-app/frontend
npm install
npm run build

echo "=== Applying Migrations and Restarting Service ==="
cd /var/www/performance-app/backend
source venv/bin/activate
pip install -r requirements.txt
flask db upgrade || true
systemctl restart performance

echo "=== Deployment Complete! Service Status: ==="
systemctl status performance --no-pager
