#!/bin/bash

set -e

echo "🚀 Deploying Backend (NestJS + Serverless)..."

cd "$(dirname "$0")/.."
cd server

echo "🧹 Cleaning old files..."
rm -rf node_modules .serverless

# -------------------------------
# Secrets (DO NOT PUSH REAL VALUES)
# -------------------------------
JWT_SECRET="dhbrW6d4J6JsEBeNgeJm16xduZOdWd1bMSoF28FzQqy"
OFFICE_LAT="23.103141295479464"
OFFICE_LNG="72.59559139416137"

# -------------------------------
# 1. Install Dependencies
# -------------------------------
echo "📦 Installing dependencies..."
npm i

# -------------------------------
# 2. Build Project
# -------------------------------
echo "🏗️ Building project..."
npm run build

echo "✅ Build Complete"

# -------------------------------
# 3. Deploy
# -------------------------------
echo "☁️ Deploying to AWS..."

JWT_SECRET="$JWT_SECRET" \
OFFICE_LAT="$OFFICE_LAT" \
OFFICE_LNG="$OFFICE_LNG" \
npx serverless deploy \
  --force \
  --config serverless.yml

echo "✅ Backend Deployed"

# -------------------------------
# 4. Show API Info
# -------------------------------
echo "🌐 Fetching API endpoints..."
npx serverless info --verbose || echo "⚠️ Could not fetch API info"