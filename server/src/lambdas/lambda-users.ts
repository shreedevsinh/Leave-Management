import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
} from 'aws-lambda';
import serverless from 'serverless-http';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { Module, Logger } from '@nestjs/common';

import { UsersModule } from '../modules/users/users.module';

@Module({
  imports: [UsersModule],
})
class UsersAppModule {}

let cachedServer: Handler;
const logger = new Logger('Lambda');

async function bootstrap(module: any): Promise<Handler> {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);

  const app = await NestFactory.create(module, adapter, {
    bufferLogs: true,
    logger: ['log', 'error', 'warn', 'debug', 'verbose'], // ✅ ENABLE ALL LOGS
  });

  app.enableCors({
    origin: ['*'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  await app.init();

  // ✅ VERY IMPORTANT (flush buffered logs to CloudWatch)
  app.flushLogs();

  logger.log('Users Lambda bootstrapped');
  console.log('Users Lambda bootstrapped (console)');

  return serverless(expressApp);
}

export const handler: Handler<
  APIGatewayProxyEvent,
  APIGatewayProxyResult
> = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const requestId = context.awsRequestId;

  logger.log(`[${requestId}] Incoming request: ${event.path}`);
  console.log(`[${requestId}] Event:`, JSON.stringify(event));

  if (!cachedServer) {
    logger.log(`[${requestId}] Bootstrapping server...`);
    cachedServer = await bootstrap(UsersAppModule);
  }

  try {
    const response = await (cachedServer as any)(event, context);

    logger.log(`[${requestId}] Response: ${response?.statusCode || 'unknown'}`);

    return response;
  } catch (error: any) {
    logger.error(`[${requestId}] Lambda error`, error?.stack || error);

    console.error(`[${requestId}] Raw error:`, error);

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
