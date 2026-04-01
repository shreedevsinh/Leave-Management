import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  Handler,
} from 'aws-lambda';
import serverless from 'serverless-http';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { Module } from '@nestjs/common';

// Import only LeaveTypesModule
import { LeaveTypesModule } from './modules/leave-types/leave-types.module';

// ✅ Create dedicated module
@Module({
  imports: [LeaveTypesModule],
})
class LeaveTypesAppModule {}

// ✅ Cache server (important for performance)
let cachedServer: Handler;

// ✅ Reusable bootstrap function
async function bootstrap(module: any): Promise<Handler> {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);

  const app = await NestFactory.create(module, adapter, {
    bufferLogs: true,
  });

  app.enableCors({
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  await app.init();

  console.log('LeaveTypes Lambda bootstrapped');

  return serverless(expressApp);
}

// ✅ Lambda handler
export const handler: Handler<
  APIGatewayProxyEvent,
  APIGatewayProxyResult
> = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (!cachedServer) {
    cachedServer = await bootstrap(LeaveTypesAppModule);
  }

  try {
    const response = await (cachedServer as any)(event, context);
    return response;
  } catch (error: any) {
    console.error('LeaveTypes Lambda error:', error);

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
