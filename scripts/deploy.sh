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

echo "✅ Backend Deployment Complete"

# -------------------------------
# 2. Fetch API URL
# -------------------------------
echo "🔗 Fetching Backend API URL..."

API_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='HttpApiUrl'].OutputValue" \
  --output text)

if [ "$API_URL" != "None" ] && [ -n "$API_URL" ]; then
  export VITE_API_URL=$API_URL
  echo "✅ API URL: $API_URL"
else
  echo "❌ ERROR: API URL not found"
  exit 1
fi

# -------------------------------
# 3. Build Frontend
# -------------------------------
echo "⚛️ Building Frontend..."

cd client

rm -rf dist
rm -f .env.production

echo "VITE_API_URL=$API_URL" > .env.production

npm install
npm run build

cd ..

# -------------------------------
# 4. Upload Frontend to S3
# -------------------------------
echo "☁️ Uploading Frontend to S3..."

BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='EmployeesLeavesBucketName'].OutputValue" \
  --output text)

aws s3 sync client/dist s3://$BUCKET_NAME --delete

# -------------------------------
# 5. Fetch Website URL
# -------------------------------
WEBSITE_URL="http://$BUCKET_NAME.s3-website.ap-south-1.amazonaws.com"

# -------------------------------
# FINAL
# -------------------------------
echo ""
echo "🎉 DEPLOYMENT SUCCESSFUL!"
echo "----------------------------------"
echo "🌐 Frontend URL:"
echo "$WEBSITE_URL"
echo ""
echo "🔗 Backend API:"
echo "$API_URL"
echo "----------------------------------"