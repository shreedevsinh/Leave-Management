import { Injectable } from '@nestjs/common';
import {
  PutCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
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

    let originalDynamoItems: any[] = [];
    let originalPrismaActiveItems: string[] = [];

    // --------------------------
    // Helpers
    // --------------------------

    const deactivateDynamoItems = async () => {
      const scanResult = await client.send(
        new ScanCommand({ TableName: this.tableName }),
      );
      const items = scanResult.Items || [];
      originalDynamoItems = [...items];

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
    };

    const createDynamoItem = async () => {
      await client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: newItem,
        }),
      );
    };

    const deactivatePrismaItems = async () => {
      const activeItems = await this.prisma.officeTiming.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      originalPrismaActiveItems.push(...activeItems.map((i) => i.id));
      await this.prisma.officeTiming.updateMany({ data: { isActive: false } });
    };

    const createPrismaItem = async () => {
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
    };

    const rollback = async () => {
      try {
        // Dynamo rollback
        if (originalDynamoItems.length) {
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
          await client.send(
            new DeleteCommand({
              TableName: this.tableName,
              Key: { id: newItem.id },
            }),
          );
        }

        // Prisma rollback
        if (originalPrismaActiveItems.length) {
          await this.prisma.officeTiming.updateMany({
            where: { id: { in: originalPrismaActiveItems } },
            data: { isActive: true },
          });
          await this.prisma.officeTiming.delete({ where: { id: newItem.id } });
        }
      } catch (err) {
        console.error('❌ Rollback failed:', err);
      }
    };

    // --------------------------
    // Main try/catch
    // --------------------------
    try {
      await deactivateDynamoItems();
      await createDynamoItem();
      await deactivatePrismaItems();
      await createPrismaItem();

      console.log('✅ Office timing created in both DynamoDB & Prisma');
      return newItem;
    } catch (error) {
      console.error('❌ Error creating office timing:', error);
      await rollback();
      throw new Error(
        'Failed to create office timing. All changes rolled back.',
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
