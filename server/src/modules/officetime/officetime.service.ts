import { Injectable } from '@nestjs/common';
import { PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoService } from 'src/dynamo/dynamo.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OfficetimeService {
  private tableName = 'OfficeTiming';

  constructor(
    private dynamo: DynamoService,
    private prisma: PrismaService,
  ) {}

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

    // Store original active items for rollback
    let originalDynamoItems: any[] = [];
    let originalPrismaActiveItems: string[] = [];

    try {
      // --------------------------
      // DynamoDB Operations
      // --------------------------
      const scanResult = await client.send(
        new ScanCommand({ TableName: this.tableName }),
      );
      const items = scanResult.Items || [];
      originalDynamoItems = [...items]; // Save for rollback

      // Deactivate all existing
      await Promise.all(
        items.map((item) =>
          client.send(
            new UpdateCommand({
              TableName: this.tableName,
              Key: { id: item.id },
              UpdateExpression: 'SET isActive = :false',
              ExpressionAttributeValues: { ':false': false },
            }),
          ),
        ),
      );

      // Insert new item
      await client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: newItem,
        }),
      );

      // --------------------------
      // Prisma Operations
      // --------------------------
      const activePrismaItems = await this.prisma.officeTiming.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      originalPrismaActiveItems.push(...activePrismaItems.map((i) => i.id));

      // Deactivate all in Prisma
      await this.prisma.officeTiming.updateMany({ data: { isActive: false } });

      // Create new in Prisma
      await this.prisma.officeTiming.create({
        data: {
          id: newItem.id,
          startTime: newItem.startTime,
          endTime: newItem.endTime,
          workingHours: newItem.workingHours,
          graceMinutes: newItem.graceMinutes,
          isActive: true,
          createdAt: new Date(newItem.createdAt),
        },
      });

      console.log(
        '✅ All set inactive + new item created in DynamoDB & Prisma',
      );
      return newItem;
    } catch (error) {
      console.error('❌ Error creating office timing:', error);

      // --------------------------
      // ROLLBACK
      // --------------------------
      try {
        // Rollback DynamoDB changes
        if (originalDynamoItems.length > 0) {
          await Promise.all(
            originalDynamoItems.map((item) =>
              client.send(
                new UpdateCommand({
                  TableName: this.tableName,
                  Key: { id: item.id },
                  UpdateExpression: 'SET isActive = :active',
                  ExpressionAttributeValues: { ':active': item.isActive },
                }),
              ),
            ),
          );

          // Remove the newly added item if it exists
          await client.send(
            new UpdateCommand({
              TableName: this.tableName,
              Key: { id: newItem.id },
              UpdateExpression: 'REMOVE id', // or delete via DeleteCommand if needed
            }),
          );
        }

        // Rollback Prisma changes
        if (originalPrismaActiveItems.length > 0) {
          await this.prisma.officeTiming.updateMany({
            where: { id: { in: originalPrismaActiveItems } },
            data: { isActive: true },
          });
          // Remove newly created item
          await this.prisma.officeTiming.delete({ where: { id: newItem.id } });
        }
      } catch (rollbackError) {
        console.error('❌ Error during rollback:', rollbackError);
      }

      throw new Error(
        'Failed to create office timing. Changes have been rolled back.',
      );
    }
  }

  // ✅ Get all Office Timings
  async getAllOfficeTimings() {
    const client = this.dynamo.getClient();

    // DynamoDB
    const dynamoResult = await client.send(
      new ScanCommand({ TableName: this.tableName }),
    );
    const dynamoItems = dynamoResult.Items || [];

    // // Prisma
    // const prismaItems = await this.prisma.officeTiming.findMany();

    // return { dynamoItems, prismaItems };
    return dynamoItems;
  }

  // ✅ Set Active Office Timing
  async setActive(id: string) {
    const client = this.dynamo.getClient();

    // --------------------------
    // DynamoDB
    // --------------------------
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
            ExpressionAttributeValues: { ':false': false },
          }),
        ),
      ),
    );

    await client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id },
        UpdateExpression: 'SET isActive = :true',
        ExpressionAttributeValues: { ':true': true },
      }),
    );

    // --------------------------
    // Prisma
    // --------------------------
    await this.prisma.officeTiming.updateMany({
      data: { isActive: false },
    });

    await this.prisma.officeTiming.update({
      where: { id },
      data: { isActive: true },
    });

    return { message: 'Office timing activated in DynamoDB & Prisma', id };
  }
}
