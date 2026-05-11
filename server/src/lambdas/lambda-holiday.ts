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

import { HolidayModule } from '../modules/holiday/holiday.module';

@Module({
  imports: [HolidayModule],
})
class HolidayAppModule {}

let cachedServer: Handler;
const logger = new Logger('Lambda');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

async function bootstrap(module: any): Promise<Handler> {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);

  const app = await NestFactory.create(module, adapter, {
    bufferLogs: true,
    logger: ['log', 'error', 'warn', 'debug', 'verbose'], // ✅ ENABLE ALL LOGS
  });

  app.enableCors({
    origin: FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  await app.init();

  // ✅ VERY IMPORTANT (flush buffered logs to CloudWatch)
  app.flushLogs();

  logger.log('Holidays Lambda bootstrapped');
  console.log('Holidays Lambda bootstrapped (console)');

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
    cachedServer = await bootstrap(HolidayAppModule);
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
        'Access-Control-Allow-Origin': FRONTEND_URL,
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
