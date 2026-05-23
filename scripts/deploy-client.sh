#!/bin/bash

set -e

echo "🚀 Deploying Frontend..."

# -------------------------------
# Move to project root
# -------------------------------
cd "$(dirname "$0")/.."

# -------------------------------
# Build React App
# -------------------------------
echo "⚛️ Building React..."

cd client

npm ci

echo "🌍 Using API URL: $VITE_API_URL"

# Remove old env
rm -f .env.production .env.production.local

# Inject API URL
echo "VITE_API_URL=$VITE_API_URL" > .env.production.local

echo "📄 Injected env file:"
cat .env.production.local

# Build frontend
npm run build

cd ..

echo "✅ Build Complete"

# -------------------------------
# Bucket + CloudFront
# -------------------------------
STACK_NAME="leave-management-app-dev"

echo "🔍 Fetching stack outputs..."

# Hardcoded bucket
BUCKET_NAME="employees-leaves-179814331655"

# Hardcoded CloudFront
CLOUDFRONT_URL="https://d1wkcjqvneyzmt.cloudfront.net"

echo "🪣 Bucket: $BUCKET_NAME"

# -------------------------------
# Upload to S3
# -------------------------------
echo "☁️ Uploading..."

aws s3 sync client/dist s3://$BUCKET_NAME --delete

echo "✅ Upload Done"

# -------------------------------
# Done
# -------------------------------
echo "🎉 Frontend Deployed!"
echo "🌐 CloudFront URL:"
echo "$CLOUDFRONT_URL"