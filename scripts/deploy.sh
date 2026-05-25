#!/bin/bash

set -e

echo "🚀 Starting FULL Deployment..."

cd "$(dirname "$0")/.."

STACK_NAME="leave-management-app-dev"

# -------------------------------
# 0. Fetch Existing CloudFront URL
# -------------------------------
echo "🔍 Fetching existing CloudFront URL..."

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontURL'].OutputValue" \
  --output text 2>/dev/null || echo "")

if [ "$CLOUDFRONT_URL" != "None" ] && [ -n "$CLOUDFRONT_URL" ]; then
  FRONTEND_URL=$CLOUDFRONT_URL
  echo "✅ Using CloudFront URL: $CLOUDFRONT_URL"
else
  FRONTEND_URL="http://localhost:5173"
  echo "⚠️ Using fallback: localhost"
fi

export FRONTEND_URL
echo "$FRONTEND_URL"

# -------------------------------
# 1. Deploy Backend
# -------------------------------
echo "📦 Step 1: Deploying Backend..."

chmod +x scripts/deploy-server.sh
./scripts/deploy-server.sh

echo "🔍 Checking if stack exists..."

if ! aws cloudformation describe-stacks --stack-name $STACK_NAME > /dev/null 2>&1; then
  echo "❌ ERROR: Stack does NOT exist. Backend deployment failed."
  exit 1
fi

echo "✅ Backend Stack Verified"

# -------------------------------
# 2. Fetch Backend API URL
# -------------------------------
echo "🔗 Fetching Backend API URL..."

API_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='HttpApiUrl'].OutputValue" \
  --output text)

if [ "$API_URL" != "None" ] && [ -n "$API_URL" ]; then
  export VITE_API_URL=$API_URL
  echo "✅ API URL set: $API_URL"
else
  echo "⚠️ API URL not found, using localhost"
  export VITE_API_URL="http://localhost:3000"
fi

# -------------------------------
# 3. Deploy Frontend
# -------------------------------
echo "⚛️ Step 2: Deploying Frontend..."

chmod +x scripts/deploy-client.sh
./scripts/deploy-client.sh

echo "✅ Frontend Done"

# -------------------------------
# 4. Fetch Latest CloudFront URL
# -------------------------------
echo "🌍 Fetching latest CloudFront URL..."

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontURL'].OutputValue" \
  --output text 2>/dev/null || echo "")

# -------------------------------
# 5. CloudFront Cache Invalidation
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
# 6. Final Output
# -------------------------------
echo ""
echo "🎉 DEPLOYMENT SUCCESSFUL!"
echo "----------------------------------"

echo "🌐 Frontend:"
echo "$CLOUDFRONT_URL"

echo ""
echo "🔗 Backend API:"
echo "$API_URL"

echo "----------------------------------"