import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
} from 'aws-lambda';
import serverless from 'serverless-http';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { Module } from '@nestjs/common';

// Import Auth Module
import { OfficetimeModule } from '../modules/officetime/officetime.module';

// Dedicated Module
@Module({
  imports: [OfficetimeModule],
})
class AuthAppModule {}

// Cache server (important for performance)
let cachedServer: Handler;

// Bootstrap function
async function bootstrap(module: any): Promise<Handler> {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);

  const app = await NestFactory.create(module, adapter, {
    bufferLogs: true,
  });

  // ✅ Proper CORS (MATCHES serverless.yml)
  app.enableCors({
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  await app.init();

  console.log('Auth Lambda bootstrapped');

  return serverless(expressApp);
}

// Lambda handler
export const handler: Handler<
  APIGatewayProxyEvent,
  APIGatewayProxyResult
> = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (!cachedServer) {
    cachedServer = await bootstrap(AuthAppModule);
  }

  try {
    const response = await (cachedServer as any)(event, context);
    return response;
  } catch (error: any) {
    console.error('Auth Lambda error:', error);

    // ✅ IMPORTANT: Add CORS headers in error response
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      },
      body: JSON.stringify({
        message: 'Internal Server Error',
        error: error?.message || 'Unknown error',
      }),
    };
  }
};
