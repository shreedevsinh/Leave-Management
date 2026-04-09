import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PutCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { CreateLeaveTypeDto } from '../leave-types/dto/create-leave-type.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { DynamoService } from 'src/dynamo/dynamo.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LeaveTypesService {
  constructor(
    private prisma: PrismaService,
    private dynamo: DynamoService,
  ) {}

  async getAllLeaveTypes() {
    try {
      // 1. Fetch from DynamoDB
      const dynamoData = await this.dynamo.getClient().send(
        new ScanCommand({
          TableName: 'LeaveTypes',
        }),
      );

      const items = dynamoData.Items || [];

      // 2. Fetch balances from RDS
      const leaveTypesWithBalances = await this.prisma.leaveType.findMany({
        include: { balances: true },
      });

      // 3. Merge both
      const merged = items.map((dynamoItem) => {
        const rdsItem = leaveTypesWithBalances.find(
          (r) => r.id.toString() === dynamoItem.id,
        );

        return {
          ...dynamoItem,
          balances: rdsItem?.balances || [],
        };
      });

      return merged;
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to fetch leave types');
    }
  }

  async createLeaveType(data: CreateLeaveTypeDto) {
    const { name, maxPerYear, isPaid } = data;
    const parsedMax = Number(maxPerYear);

    // ✅ Generate ID manually (important)
    const id = uuidv4(); // or use uuid()

    try {
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

      const count = existingType.Count ?? 0;

      if (count > 0) {
        throw new BadRequestException(
          `Leave type with name '${name}' already exists`,
        );
      }

      // ✅ 1. Create in DynamoDB FIRST
      const type = await this.dynamo.getClient().send(
        new PutCommand({
          TableName: 'LeaveTypes',
          Item: {
            id,
            name,
            maxPerYear: parsedMax,
            isPaid,
          },
        }),
      );

      return type;
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to create leave type');
    }
  }

  async deleteLeaveType(id: string): Promise<boolean> {
    try {
      // await this.prisma.leaveType.delete({ where: { id: String(id) } });

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
