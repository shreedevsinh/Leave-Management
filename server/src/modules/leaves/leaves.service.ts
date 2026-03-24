import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DynamoService } from 'src/dynamo/dynamo.service';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { Prisma, Leave } from '@prisma/client';

@Injectable()
export class LeavesService {
  constructor(
    private prisma: PrismaService,
    private dynamo: DynamoService,
  ) {}

  // ✅ Utility: calculate days
  private calculateDays(start: Date, end: Date): number {
    const diff = end.getTime() - start.getTime();
    return diff / (1000 * 60 * 60 * 24) + 1;
  }

  // ✅ Split leave by year
  private splitLeaveByYear(
    start: Date,
    end: Date,
  ): { year: number; start: Date; end: Date }[] {
    const result: { year: number; start: Date; end: Date }[] = [];
    let current = new Date(start);

    while (current <= end) {
      const yearEnd = new Date(current.getFullYear(), 11, 31);
      const segmentEnd = end < yearEnd ? end : yearEnd;

      result.push({
        year: current.getFullYear(),
        start: new Date(current),
        end: new Date(segmentEnd),
      });

      current = new Date(segmentEnd);
      current.setDate(current.getDate() + 1);
    }

    return result;
  }

  // ✅ Resolve leave split (Normal + Paid)
  private async resolveLeaveSplit(
    tx: Prisma.TransactionClient,
    userId: number,
    typeId: number,
    year: number,
    days: number,
  ): Promise<{ typeId: number; days: number }[]> {
    let balance = await tx.leaveBalance.findUnique({
      where: { userId_typeId_year: { userId, typeId, year } },
    });

    const type = await tx.leaveType.findUnique({
      where: { id: typeId },
    });

    if (!type) {
      throw new BadRequestException('Invalid leave type');
    }

    if (!balance) {
      balance = await tx.leaveBalance.create({
        data: {
          userId,
          typeId,
          year,
          total: type.maxPerYear,
          used: 0,
          remaining: type.maxPerYear,
        },
      });
    }

    // ✅ Enough balance
    if (balance.remaining >= days) {
      return [{ typeId, days }];
    }

    const result: { typeId: number; days: number }[] = [];

    // Partial normal leave
    if (balance.remaining > 0) {
      result.push({ typeId, days: balance.remaining });
    }

    // Remaining → Paid Leave
    const paidLeaveType = await tx.leaveType.findFirst({
      where: { name: 'Paid Leave' },
    });

    if (!paidLeaveType) {
      throw new BadRequestException('Paid Leave type not configured');
    }

    result.push({
      typeId: paidLeaveType.id,
      days: days - balance.remaining,
    });

    return result;
  }

  // ✅ Create Leave
  async createLeave(data: CreateLeaveDto): Promise<Leave[]> {
    const { userId, typeId, startDate, endDate, reason } = data;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      throw new BadRequestException('End date cannot be before start date');
    }

    const segments = this.splitLeaveByYear(start, end);

    const leaves = await this.prisma.$transaction(async (tx) => {
      // ✅ Prevent overlapping leave
      const overlap = await tx.leave.findFirst({
        where: {
          userId,
          status: { in: ['PENDING', 'APPROVED'] },
          startDate: { lte: end },
          endDate: { gte: start },
        },
      });

      if (overlap) {
        throw new BadRequestException('Leave already exists');
      }

      const createdLeaves: Leave[] = [];

      for (const segment of segments) {
        const days = this.calculateDays(segment.start, segment.end);

        const splits = await this.resolveLeaveSplit(
          tx,
          userId,
          typeId,
          segment.year,
          days,
        );

        for (const split of splits) {
          const leave = await tx.leave.create({
            data: {
              userId,
              typeId: split.typeId,
              startDate: segment.start,
              endDate: segment.end,
              totalDays: split.days,
              reason,
              status: 'PENDING',
            },
          });

          createdLeaves.push(leave);
        }
      }

      return createdLeaves;
    });

    // ✅ Dynamo Sync (non-blocking)
    try {
      const dynamoClient = this.dynamo.getClient();

      await Promise.all(
        leaves.map((leave) =>
          dynamoClient.send(
            new PutCommand({
              TableName: 'Leaves',
              Item: {
                id: leave.id.toString(),
                userId: leave.userId.toString(),
                typeId: leave.typeId.toString(),
                startDate: leave.startDate.toISOString(),
                endDate: leave.endDate.toISOString(),
                totalDays: leave.totalDays,
                reason: leave.reason,
                status: leave.status,
                createdAt: leave.createdAt.toISOString(),
                updatedAt: leave.updatedAt.toISOString(),
              },
            }),
          ),
        ),
      );
    } catch (error) {
      console.error('❌ DynamoDB Sync Failed:', error);
    }

    return leaves;
  }

  // ✅ Get all leaves
  async getAllLeaves() {
    return this.prisma.leave.findMany({
      include: {
        user: true,
        type: true,
      },
    });
  }

  // ✅ Get by ID
  async getLeaveById(id: number) {
    return this.prisma.leave.findUnique({
      where: { id },
      include: {
        user: true,
        type: true,
        logs: true,
      },
    });
  }

  // ✅ Approve / Reject Leave
  async updateLeaveStatus(
    id: number,
    body: {
      status: 'APPROVED' | 'REJECTED' | 'PENDING';
      approvedBy?: number;
      rejectionReason?: string;
    },
  ) {
    const leave = await this.prisma.leave.update({
      where: { id },
      data: {
        status: body.status,
        approvedBy: body.approvedBy,
        rejectionReason: body.rejectionReason,
      },
    });

    // ✅ Sync to Dynamo
    await this.dynamo.getClient().send(
      new UpdateCommand({
        TableName: 'Leaves',
        Key: { id: String(id) },
        UpdateExpression:
          'SET #status = :status, #approvedBy = :approvedBy, #rejectionReason = :rejectionReason',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#approvedBy': 'approvedBy',
          '#rejectionReason': 'rejectionReason',
        },
        ExpressionAttributeValues: {
          ':status': body.status,
          ':approvedBy': body.approvedBy?.toString() || '',
          ':rejectionReason': body.rejectionReason || '',
        },
      }),
    );

    // ✅ Deduct balance ONLY on approval
    if (body.status === 'APPROVED') {
      await this.prisma.leaveBalance.updateMany({
        where: {
          userId: leave.userId,
          typeId: leave.typeId,
          year: new Date(leave.startDate).getFullYear(),
        },
        data: {
          used: { increment: leave.totalDays },
          remaining: { decrement: leave.totalDays },
        },
      });

      await this.dynamo.getClient().send(
        new UpdateCommand({
          TableName: 'LeaveBalances',
          Key: {
            userId: String(leave.userId),
            typeId: String(leave.typeId),
            year: String(new Date(leave.startDate).getFullYear()),
          },
          UpdateExpression:
            'SET #used = #used + :used, #remaining = #remaining - :remaining',
          ExpressionAttributeNames: {
            '#used': 'used',
            '#remaining': 'remaining',
          },
          ExpressionAttributeValues: {
            ':used': leave.totalDays,
            ':remaining': leave.totalDays,
          },
        }),
      );
    }

    return leave;
  }
}
