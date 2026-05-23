service: leave-management-app

provider:
  name: aws
  runtime: nodejs20.x
  region: ap-south-1
  timeout: 29
  memorySize: 1024

  environment:
    NODE_ENV: production
    FRONTEND_URL: ${env:FRONTEND_URL}

  httpApi:
    cors:
      allowedOrigins:
        - ${env:FRONTEND_URL}
        - http://localhost:5173

      allowedHeaders:
        - Content-Type
        - Authorization

      allowedMethods:
        - GET
        - POST
        - PUT
        - PATCH
        - DELETE
        - OPTIONS

      allowCredentials: true
      maxAge: 3600

  iamRoleStatements:
    - Effect: Allow
      Action:
        - dynamodb:GetItem
        - dynamodb:Scan
        - dynamodb:Query
        - dynamodb:PutItem
        - dynamodb:UpdateItem
        - dynamodb:DeleteItem
        - dynamodb:BatchGetItem
        - dynamodb:BatchWriteItem

      Resource:
        - arn:aws:dynamodb:ap-south-1:*:table/*

    - Effect: Allow
      Action:
        - logs:CreateLogGroup
        - logs:CreateLogStream
        - logs:PutLogEvents

      Resource: "*"

    - Effect: Allow
      Action:
        - secretsmanager:GetSecretValue

      Resource:
        - arn:aws:secretsmanager:${aws:region}:${aws:accountId}:secret:leave-management/production-new*

functions:
  ${file(../infrastructure/api/functions.yml)}

plugins:
  - serverless-esbuild

custom:
  esbuild:
    bundle: true
    minify: true
    sourcemap: false
    target: node20
    platform: node

    concurrency: 1
    zipConcurrency: 1

    exclude:
      - aws-sdk

package:
  individually: true

  patterns:
    - '!node_modules/**'
    - '!client/**'
    - '!scripts/**'
    - '!infrastructure/**'
    - '!**/*.md'
    - '!**/*.map'
    - '!**/test/**'
    - '!**/tests/**'

resources:
  - ${file(../infrastructure/secrets/secrets.yml)}