import { Handler, Context, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import serverless from 'serverless-http';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

import { Module } from '@nestjs/common';

// Import your modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { LeaveTypesModule } from './modules/leave-types/leave-types.module';

// Root NestJS module combining all feature modules
@Module({
  imports: [AuthModule, UsersModule, LeavesModule, LeaveTypesModule],
})
class AppModule {}

let cachedServer: Handler;

// Bootstrap function to initialize NestJS app and Express adapter
async function bootstrap(): Promise<Handler> {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);

  const app = await NestFactory.create(AppModule, adapter, { bufferLogs: true });

  app.enableCors({
    origin: '*',
    methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  });

  await app.init();

  console.log('Lambda bootstrapped successfully');

  return serverless(expressApp);
}

// Lambda handler
export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
  event,
  context,
) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (!cachedServer) {
    cachedServer = await bootstrap();
  }

  try {
    const response = await cachedServer(event, context);
    return response;
  } catch (err) {
    console.error('Lambda execution error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error', details: err.message }),
    };
  }
};