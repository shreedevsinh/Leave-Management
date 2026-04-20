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

npm ci --omit=dev

# -------------------------------
# 2. Build Project
# -------------------------------
echo "🏗️ Building project..."
npm run build

echo "✅ Build Complete"

# -------------------------------
# 3. Remove Heavy Prisma Engines (before build)
# -------------------------------
echo "🧹 Cleaning Prisma engines..."
# rm -rf node_modules/.prisma
rm -rf node_modules/@prisma/engines

# -------------------------------
# 4. Deploy
# -------------------------------
echo "☁️ Deploying to AWS..."
npx serverless deploy --force --config serverless.yml

echo "✅ Backend Deployed"

# -------------------------------
# 5. Show API Info (no Outputs used)
# -------------------------------
echo "🌐 Fetching API endpoints..."

npx serverless info --verbose || echo "⚠️ Could not fetch API info"