import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DynamoService } from 'src/dynamo/dynamo.service';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { console } from 'inspector';

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

  async createLeave(data: any) {
    const { userId, typeId, startDate, endDate, reason } = data;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      throw new BadRequestException('End date cannot be before start date');
    }

    const totalDays = this.calculateDays(start, end);
    const year = new Date().getFullYear();

    const balance = await this.prisma.leaveBalance.findUnique({
      where: {
        userId_typeId_year: { userId, typeId, year },
      },
    });

    if (!balance || balance.remaining < totalDays) {
      console.log(balance);
      throw new BadRequestException('Insufficient leave balance');
    }

    // ✅ DB transaction ONLY for relational consistency
    const leave = await this.prisma.$transaction(async (tx) => {
      const createdLeave = await tx.leave.create({
        data: {
          userId,
          typeId,
          startDate: start,
          endDate: end,
          totalDays,
          reason,
        },
      });

      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: {
          used: { increment: totalDays },
          remaining: { decrement: totalDays },
        },
      });

      return createdLeave;
    });

    const dynamoClient = this.dynamo.getClient();

    // ✅ Dynamo operations OUTSIDE transaction (correct pattern)
    try {
      await Promise.all([
        dynamoClient.send(
          new UpdateCommand({
            TableName: 'LeaveBalances',
            Key: {
              id: balance.id.toString(),
            },
            UpdateExpression: `
          SET used = :used,
              remaining = :remaining
        `,
            ExpressionAttributeValues: {
              ':used': balance.used + totalDays,
              ':remaining': balance.remaining - totalDays,
            },
          }),
        ),

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
              approvedBy: leave.approvedBy,
              rejectionReason: leave.rejectionReason,
              appliedAt: leave.appliedAt.toISOString(),
              createdAt: leave.createdAt.toISOString(),
              updatedAt: leave.updatedAt.toISOString(),
            },
          }),
        ),
      ]);
    } catch (error) {
      console.error('❌ DynamoDB Error:', error);
      throw error;
    }

    return leave;
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

  async updateLeaveStatus(id: number, body: any) {
    const leave = await this.prisma.leave.update({
      where: { id },
      data: {
        status: body.status,
        approvedBy: body.approvedBy,
        rejectionReason: body.rejectionReason,
      },
    });

    await this.dynamo.getClient().send(
      new UpdateCommand({
        TableName: 'Leaves',
        Key: {
          id: String(id), // make sure this matches DynamoDB PK type
        },
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

    return leave;
  }
}
