#!/bin/bash

set -e

echo "🚀 Deploying Backend (NestJS + Serverless)..."

cd "$(dirname "$0")/.."
cd server

echo "🧹 Cleaning old files..."
rm -rf node_modules .serverless

# -------------------------------
# 1. Install Dependencies
# -------------------------------
echo "📦 Installing dependencies..."
npm i
echo "Uninstalling serverless..."
npm uninstall serverless
serverless --version
echo "Installing serverless@3..."
npm install -g serverless@3
serverless --version

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
echo "FRONTEND_URL=$FRONTEND_URL"


FRONTEND_URL="$FRONTEND_URL" npx serverless deploy \
  --force \
  --config serverless.yml

echo "✅ Backend Deployed"

# -------------------------------
# 4. Show API Info
# -------------------------------
echo "🌐 Fetching API endpoints..."
npx serverless info --verbose || echo "⚠️ Could not fetch API info"