import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { CreateLeaveTypeDto } from '../leave-types/dto/create-leave-type.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { DynamoService } from 'src/dynamo/dynamo.service';

@Injectable()
export class LeaveTypesService {
  constructor(
    private prisma: PrismaService,
    private dynamo: DynamoService,
  ) {}

  async getAllLeaveTypes() {
    const leaveTypes = await this.prisma.leaveType.findMany({
      include: {
        balances: true,
      },
    });
    return leaveTypes;
  }

  async createLeaveType(data: CreateLeaveTypeDto) {
    const { name, maxPerYear, isPaid } = data;
    const parsedMax = Number(maxPerYear);

    const existing = await this.prisma.leaveType.findUnique({
      where: { name },
    });
    if (existing) {
      throw new BadRequestException('Leave type already exists');
    }

    try {
      const type = await this.prisma.leaveType.create({
        data: { name, maxPerYear: parsedMax, isPaid },
      });

      await this.dynamo.getClient().send(
        new PutCommand({
          TableName: 'LeaveTypes',
          Item: {
            id: type.id.toString(),
            name: type.name,
            maxPerYear: type.maxPerYear,
            isPaid: type.isPaid,
          },
        }),
      );

      return {
        id: type.id,
        name: type.name,
        maxPerYear: type.maxPerYear,
        isPaid: type.isPaid,
      };
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to create leave type');
    }
  }

  async deleteLeaveType(id: string): Promise<boolean> {
    try {
      await this.prisma.leaveType.delete({ where: { id: Number(id) } });

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
