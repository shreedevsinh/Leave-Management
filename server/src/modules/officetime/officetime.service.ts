import { Injectable, Query } from '@nestjs/common';
import {
  PutCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoService } from '../../dynamo/dynamo.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OfficetimeService {
  private tableName = 'OfficeTiming';

  constructor(private dynamo: DynamoService) {}

  private async deactivateAll(client: any) {
    const result = await client.send(
      new ScanCommand({ TableName: this.tableName }),
    );

    const items = result.Items || [];

    await Promise.all(
      items.map((item) =>
        client.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { id: item.id },
            UpdateExpression: 'SET isActive = :false',
            ExpressionAttributeValues: {
              ':false': false,
            },
          }),
        ),
      ),
    );

    return items;
  }

  // ✅ Create Office Timing
  async create(data: {
    startTime: string;
    endTime: string;
    workingHours: number;
    graceMinutes: number;
  }) {
    const client = this.dynamo.getClient();
    const id = uuidv4();
    const newItem = {
      id,
      startTime: data.startTime,
      endTime: data.endTime,
      workingHours: data.workingHours,
      graceMinutes: data.graceMinutes,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    try {
      await this.deactivateAll(client);

      await client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: newItem,
        }),
      );

      return newItem;
    } catch (error) {
      console.error('❌ Error creating office timing:', error);
      throw new Error('Failed to create office timing.');
    }
  }

  // ✅ Get all Office Timings
  async getAllOfficeTimings() {
    try {
      const dynamoResult = await this.dynamo.getClient().send(
        new ScanCommand({ TableName: this.tableName }),
      );
      const dynamoItems = dynamoResult.Items || [];
      return dynamoItems;
    } catch (err) {
      console.error('❌ ERROR:', err);
    }
  }

  async getActiveOfficeTiming() {
    try {
      const dynamoResult = await this.dynamo.getClient().send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'isActive = :active',
          ExpressionAttributeValues: {
            ':active': true,
          },
        }),
      );

      const dynamoItems = dynamoResult.Items || [];

      // return first active office timing
      return dynamoItems[0] || null;
    } catch (err) {
      console.error('❌ ERROR:', err);
      throw err;
    }
  }

  // ✅ Set Active Office Timing
  async setActive(id: string) {
    const client = this.dynamo.getClient();

    await this.deactivateAll(client);

    await client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id },
        UpdateExpression: 'SET isActive = :true',
        ExpressionAttributeValues: { ':true': true },
      }),
    );

    return { message: 'Office timing activated in DynamoDB', id };
  }
}
