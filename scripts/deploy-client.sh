`deploy-client.sh`
#!/bin/bash

set -e

echo "🚀 Deploying Frontend..."

# -------------------------------
# 2. Build React App
# -------------------------------
echo "⚛️ Building React..."
cd client

npm ci

echo "🌍 Using API URL: $VITE_API_URL"

# ✅ Remove old env to avoid conflicts
rm -f .env.production .env.production.local

# ✅ Inject correct API URL
echo "VITE_API_URL=$VITE_API_URL" > .env.production.local

# 🧪 Debug (optional)
echo "📄 Injected env file:"
cat .env.production.local

# ✅ Build
npm run build

cd ..

echo "✅ Build Complete"

# -------------------------------
# 3. Get Stack Info
# -------------------------------
STACK_NAME="leave-management-app-dev"

echo "🔍 Fetching stack outputs..."

BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='EmployeesLeavesBucketName'].OutputValue" \
  --output text)

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontURL'].OutputValue" \
  --output text)

echo "🪣 Bucket: $BUCKET_NAME"

# -------------------------------
# 4. Upload to S3
# -------------------------------
echo "☁️ Uploading..."

aws s3 sync client/dist s3://$BUCKET_NAME --delete

echo "✅ Upload Done"

# -------------------------------
# 5. Done
# -------------------------------
echo "🎉 Frontend Deployed!"
echo "🌐 CloudFront URL:"
echo "$CLOUDFRONT_URL"