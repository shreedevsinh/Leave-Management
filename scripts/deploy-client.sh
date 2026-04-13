#!/bin/bash

set -e

echo "🚀 Deploying Frontend..."

# -------------------------------
# 1. Build React App
# -------------------------------
echo "⚛️ Building React..."
cd client
npm ci
npm run build
cd ..

echo "✅ Build Complete"

# -------------------------------
# 2. Get Stack Info
# -------------------------------
STACK_NAME="leave-management-app-dev"

echo "🔍 Fetching stack outputs..."

BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='EmployeesLeavesBucketName'].OutputValue" \
  --output text)

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name leave-management-app-dev \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontURL'].OutputValue" \
  --output text)

echo "🪣 Bucket: $BUCKET_NAME"

# -------------------------------
# 3. Upload to S3
# -------------------------------
echo "☁️ Uploading..."

aws s3 sync client/dist s3://$BUCKET_NAME --delete

echo "✅ Upload Done"

# -------------------------------
# 4. Done
# -------------------------------
echo "🎉 Frontend Deployed!"
echo "🌐 CloudFront URL:"
echo "$CLOUDFRONT_URL"