import { Injectable } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

@Injectable()
export class DynamoService {
  private client: DynamoDBDocumentClient;

  constructor() {
    const dynamo = new DynamoDBClient({
      region: 'ap-south-1', // change if needed
    });

    this.client = DynamoDBDocumentClient.from(dynamo);
  }

  getClient() {
    return this.client;
  }
}
