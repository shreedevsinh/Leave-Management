#!/bin/bash

set -e

echo "🚀 Starting FULL Deployment..."

cd "$(dirname "$0")/.."

STACK_NAME="leave-management-app-dev"

# -------------------------------
# 1. Deploy Backend
# -------------------------------
echo "📦 Step 1: Deploying Backend..."
./scripts/deploy-server.sh

echo "🔍 Checking if stack exists..."

if ! aws cloudformation describe-stacks --stack-name $STACK_NAME > /dev/null 2>&1; then
  echo "❌ ERROR: Stack does NOT exist. Backend deployment failed."
  echo "👉 Fix backend issues first (run: sls deploy --debug)"
  exit 1
fi

echo "✅ Backend Stack Verified"

# -------------------------------
# 2. Deploy Frontend
# -------------------------------
echo "⚛️ Step 2: Deploying Frontend..."
./scripts/deploy-client.sh

echo "✅ Frontend Done"

# -------------------------------
# 3. CloudFront Invalidation
# -------------------------------
echo "🌍 Step 3: Invalidating CloudFront Cache..."

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendDistributionId'].OutputValue" \
  --output text)

if [ "$DISTRIBUTION_ID" != "None" ] && [ -n "$DISTRIBUTION_ID" ]; then
  aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/*"

  echo "✅ Cache Invalidated"
else
  echo "⚠️ CloudFront Distribution not found, skipping..."
fi

# -------------------------------
# 4. Show Final URLs
# -------------------------------
echo "🌐 Fetching URLs..."

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontURL'].OutputValue" \
  --output text)

API_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='HttpApiUrl'].OutputValue" \
  --output text)

echo ""
echo "🎉 DEPLOYMENT SUCCESSFUL!"
echo "----------------------------------"
echo "🌐 Frontend:"
echo "$CLOUDFRONT_URL"
echo ""
echo "🔗 Backend API:"
echo "$API_URL"
echo "----------------------------------"