import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PutCommand, DeleteCommand, ScanCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { CreateLeaveTypeDto } from '../leave-types/dto/create-leave-type.dto';
import { DynamoService } from '../../dynamo/dynamo.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LeaveTypesService {
  constructor(private dynamo: DynamoService) {}

  async getAllLeaveTypes() {
    try {
      // 1. Fetch from DynamoDB
      const dynamoData = await this.dynamo.getClient().send(
        new ScanCommand({
          TableName: 'LeaveTypes',
        }),
      );

      const items = dynamoData.Items || [];

      return items;
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to fetch leave types');
    }
  }

  async createLeaveType(dto: CreateLeaveTypeDto) {
    const { name, maxPerYear, isPaid } = dto;

    const parsedMax = Number(maxPerYear);

    // ✅ Generate UUID
    const id = uuidv4();

    try {
      // ✅ Check existing leave type
      const existingType = await this.dynamo.getClient().send(
        new ScanCommand({
          TableName: 'LeaveTypes',
          FilterExpression: '#name = :name',
          ExpressionAttributeNames: {
            '#name': 'name',
          },
          ExpressionAttributeValues: {
            ':name': name,
          },
        }),
      );

      if ((existingType.Count ?? 0) > 0) {
        throw new BadRequestException(
          `Leave type with name '${name}' already exists`,
        );
      }

      // ✅ Create item object
      const item = {
        id,
        name,
        maxPerYear: parsedMax,
        isPaid,
        createdAt: new Date().toISOString(),
      };

      // ✅ Insert into DynamoDB
      await this.dynamo.getClient().send(
        new PutCommand({
          TableName: 'LeaveTypes',
          Item: item,
        }),
      );

      // ✅ Return inserted item
      return {
        success: true,
        message: 'Leave type created successfully',
        leaveType: item,
      };
    } catch (err) {
      console.error('❌ createLeaveType error:', err);

      // ✅ Preserve existing HTTP exceptions
      if (err instanceof BadRequestException) {
        throw err;
      }

      throw new InternalServerErrorException('Failed to create leave type');
    }
  }

  async deleteLeaveType(id: string): Promise<boolean> {
    const client = this.dynamo.getClient();
    try {
      const LeaveBalances = await client.send(
        new QueryCommand({
          TableName: 'LeaveBalances',
          IndexName: 'leaveTypeId-index',
          KeyConditionExpression: 'leaveTypeId = :id',
          ExpressionAttributeValues: {
            ':id': id,
          },
        }),
      );

      if (LeaveBalances.Items?.length) {
        await client.send(
          new BatchWriteCommand({
            RequestItems: {
              LeaveBalances: LeaveBalances.Items.map((leave) => ({
                DeleteRequest: {
                  Key: { id: leave.id },
                },
              })),
            },
          }),
        );
      }

      await this.dynamo.getClient().send(
        new DeleteCommand({
          TableName: 'LeaveTypes',
          Key: { id },
        }),
      );

      return true;
    } catch {
      throw new InternalServerErrorException('Failed to delete employee');
    }
  }
}
