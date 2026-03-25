import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DynamoService } from 'src/dynamo/dynamo.service';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { Prisma, Leave, LeaveType } from '@prisma/client';

@Injectable()
export class LeavesService {
  constructor(
    private prisma: PrismaService,
    private dynamo: DynamoService,
  ) {}

  // ✅ Utility: calculate days
  private calculateDays(start: Date, end: Date): number {
    const s = new Date(start);
    const e = new Date(end);

    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);

    const diff = e.getTime() - s.getTime();

    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
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
    console.log('📥 Incoming createLeave request:', data);

    const { userId, typeId, startDate, endDate, reason, status } = data;

    const start = new Date(startDate);
    const end = new Date(endDate);

    console.log('📅 Parsed Dates:', { start, end });

    if (end < start) {
      console.error('❌ Invalid date range');
      throw new BadRequestException('End date cannot be before start date');
    }

    const segments = this.splitLeaveByYear(start, end);
    console.log('🧩 Split Segments:', segments);

    const leaves = await this.prisma.$transaction(async (tx) => {
      console.log('🔄 Transaction started');

      // ✅ Prevent overlapping leave
      const overlap = await tx.leave.findFirst({
        where: {
          userId: Number(userId),
          status: { in: ['PENDING', 'APPROVED'] },
          startDate: { lte: end },
          endDate: { gte: start },
        },
      });

      console.log('🔍 Overlap check result:', overlap);

      if (overlap) {
        console.error('❌ Overlapping leave detected');
        throw new BadRequestException('Leave already exists');
      }

      const createdLeaves: Leave[] = [];

      for (const segment of segments) {
        console.log('➡️ Processing segment:', segment);

        const days = this.calculateDays(segment.start, segment.end);
        console.log('📊 Calculated days:', days);

        const splits = await this.resolveLeaveSplit(
          tx,
          userId,
          typeId,
          segment.year,
          days,
        );

        console.log('🔀 Leave splits:', splits);

        for (const split of splits) {
          console.log('🧾 Creating leave with split:', split);

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

          console.log('✅ Leave created:', leave);

          createdLeaves.push(leave);
        }
      }

      console.log('✅ Transaction completed');
      return createdLeaves;
    });

    console.log('📦 Leaves after transaction:', leaves);

    // ✅ Dynamo Sync (non-blocking)
    try {
      console.log('☁️ Starting DynamoDB sync');

      const dynamoClient = this.dynamo.getClient();

      await Promise.all(
        leaves.map((leave) => {
          console.log('📤 Syncing leave to Dynamo:', leave.id);

          return dynamoClient.send(
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
          );
        }),
      );

      console.log('✅ DynamoDB sync completed');
    } catch (error) {
      console.error('❌ DynamoDB Sync Failed:', error);
    }

    if (status === 'APPROVED') {
      for (const leave of leaves) {
        console.log('⚡ Auto-approving leave:', leave.id);

        await this.updateLeaveStatus(leave.id, {
          status: 'APPROVED',
          approvedBy: userId,
        });

        console.log('✅ Leave approved:', leave.id);
      }
    }

    console.log('🎉 createLeave completed successfully');
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
