#!/bin/bash

set -e

echo "🚀 Deploying Backend (NestJS + Serverless)..."

# -------------------------------
# Move to server folder
# -------------------------------
cd "$(dirname "$0")/.."
cd server

# -------------------------------
# Clean old files
# -------------------------------
echo "🧹 Cleaning old files..."
rm -rf node_modules .serverless dist

# -------------------------------
# Environment Variables
# -------------------------------
JWT_SECRET="dhbrW6d4J6JsEBeNgeJm16xduZOdWd1bMSoF28FzQqy"

OFFICE_LAT="23.103141295479464"
OFFICE_LNG="72.59559139416137"

FRONTEND_URL="http://localhost:5173"

# -------------------------------
# Install dependencies
# -------------------------------
echo "📦 Installing dependencies..."
npm install --no-audit --no-fund

# -------------------------------
# Build NestJS project
# -------------------------------
echo "🏗️ Building project..."
npm run build

echo "✅ Backend build complete"

# -------------------------------
# Verify Serverless Version
# -------------------------------
echo "📌 Using Serverless v3..."
npx serverless@3 --version

# -------------------------------
# Deploy to AWS
# -------------------------------
echo "☁️ Deploying backend to AWS..."


JWT_SECRET="$JWT_SECRET" \
OFFICE_LAT="$OFFICE_LAT" \
OFFICE_LNG="$OFFICE_LNG" \
FRONTEND_URL="$FRONTEND_URL" \
npx serverless@3 deploy \
  --stage dev \
  --force \
  --config serverless.yml

echo "✅ Backend deployed successfully"

# -------------------------------
# Show API info
# -------------------------------
echo "🌐 Fetching API endpoints..."

npx serverless@3 info \
  --verbose \
  --stage dev || echo "⚠️ Could not fetch API info"