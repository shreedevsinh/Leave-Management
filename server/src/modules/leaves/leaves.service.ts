import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DynamoService } from 'src/dynamo/dynamo.service';
import {
  PutCommand,
  UpdateCommand,
  ScanCommand,
  GetCommand,
  BatchGetCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
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
  private async resolveLeaveSplitDynamo(
    userId: string,
    typeId: string,
    year: number,
    days: number,
  ): Promise<{ typeId: string; days: number }[]> {
    const dynamoClient = this.dynamo.getClient();

    // ====================================
    // ✅ 1. Get Leave Type
    // ====================================
    const typeRes = await dynamoClient.send(
      new GetCommand({
        TableName: 'LeaveTypes',
        Key: { id: String(typeId) },
      }),
    );

    const type = typeRes.Item;

    if (!type) {
      throw new BadRequestException('Invalid leave type');
    }

    // ====================================
    // ✅ 2. Get Leave Balance
    // (Assuming composite key OR unique id)
    // ====================================
    const balanceRes = await dynamoClient.send(
      new GetCommand({
        TableName: 'LeaveBalances',
        Key: {
          userId: String(userId),
          typeId: String(typeId),
          year: String(year),
        },
      }),
    );

    let balance = balanceRes.Item;

    // ====================================
    // ✅ 3. Create balance if not exists
    // ====================================
    if (!balance) {
      balance = {
        id: uuidv4(),
        userId: String(userId),
        typeId: String(typeId),
        year: String(year),
        total: type.maxPerYear,
        used: 0,
        remaining: type.maxPerYear,
      };

      await dynamoClient.send(
        new PutCommand({
          TableName: 'LeaveBalances',
          Item: balance,
        }),
      );
    }

    // ====================================
    // ✅ 4. Enough balance
    // ====================================
    if (balance.remaining >= days) {
      return [{ typeId, days }];
    }

    const result: { typeId: string; days: number }[] = [];

    // ====================================
    // ✅ 5. Partial normal leave
    // ====================================
    if (balance.remaining > 0) {
      result.push({
        typeId,
        days: balance.remaining,
      });
    }

    // ====================================
    // ✅ 6. Find "Paid Leave"
    // ⚠️ No direct query → using Scan
    // ====================================
    const paidLeaveRes = await dynamoClient.send(
      new ScanCommand({
        TableName: 'LeaveTypes',
        FilterExpression: '#name = :name',
        ExpressionAttributeNames: {
          '#name': 'name',
        },
        ExpressionAttributeValues: {
          ':name': 'Paid Leave',
        },
      }),
    );

    const paidLeaveType = paidLeaveRes.Items?.[0];

    if (!paidLeaveType) {
      throw new BadRequestException('Paid Leave type not configured');
    }

    // ====================================
    // ✅ 7. Remaining → Paid Leave
    // ====================================
    result.push({
      typeId: paidLeaveType.id,
      days: days - balance.remaining,
    });

    return result;
  }

  // ✅ Create Leave
  async createLeave(data: CreateLeaveDto) {
    const { userId, typeId, startDate, endDate, reason, status } = data;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      throw new BadRequestException('End date cannot be before start date');
    }

    const segments = this.splitLeaveByYear(start, end);

    const dynamoClient = this.dynamo.getClient();

    const createdLeaves: any[] = [];

    try {
      // ====================================
      // ✅ 1. Check overlap (Dynamo)
      // ====================================
      const overlapRes = await dynamoClient.send(
        new ScanCommand({
          TableName: 'Leaves',
          FilterExpression:
            '#userId = :userId AND (#status = :p OR #status = :a) AND #start <= :end AND #end >= :start',
          ExpressionAttributeNames: {
            '#userId': 'userId',
            '#status': 'status',
            '#start': 'startDate',
            '#end': 'endDate',
          },
          ExpressionAttributeValues: {
            ':userId': String(userId),
            ':p': 'PENDING',
            ':a': 'APPROVED',
            ':start': start.toISOString(),
            ':end': end.toISOString(),
          },
        }),
      );

      if (overlapRes.Items?.length) {
        throw new BadRequestException('Leave already exists');
      }

      // ====================================
      // ✅ 2. Create leaves in Dynamo
      // ====================================
      for (const segment of segments) {
        const days = this.calculateDays(segment.start, segment.end);

        // ⚠️ Simplified (no Prisma tx)
        const splits = await this.resolveLeaveSplitDynamo(
          userId,
          typeId,
          segment.year,
          days,
        );

        for (const split of splits) {
          const leaveId = uuidv4();

          const item = {
            id: leaveId,
            userId: String(userId),
            typeId: String(split.typeId),
            startDate: segment.start.toISOString(),
            endDate: segment.end.toISOString(),
            totalDays: split.days,
            reason,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await dynamoClient.send(
            new PutCommand({
              TableName: 'Leaves',
              Item: item,
            }),
          );

          createdLeaves.push(item);
        }
      }

      // ====================================
      // ✅ 3. Sync to RDS (non-blocking)
      // ====================================
      try {
        await Promise.all(
          createdLeaves.map((leave) =>
            this.prisma.leave.create({
              data: {
                id: leave.id,
                userId: leave.userId,
                typeId: leave.typeId,
                startDate: new Date(leave.startDate),
                endDate: new Date(leave.endDate),
                totalDays: leave.totalDays,
                reason: leave.reason,
                status: leave.status,
              },
            }),
          ),
        );
      } catch (err) {
        console.error('❌ RDS sync failed:', err);
      }

      // ====================================
      // ✅ 4. Auto approve
      // ====================================
      if (status === 'APPROVED') {
        for (const leave of createdLeaves) {
          await this.updateLeaveStatus(leave.id, {
            status: 'APPROVED',
            approvedBy: userId,
          });
        }
      }

      return createdLeaves;
    } catch (error) {
      console.error(error);

      // ====================================
      // ❗ Rollback Dynamo
      // ====================================
      await Promise.all(
        createdLeaves.map((l) =>
          dynamoClient.send(
            new DeleteCommand({
              TableName: 'Leaves',
              Key: { id: l.id },
            }),
          ),
        ),
      );

      throw new InternalServerErrorException('Failed to create leave');
    }
  }

  // ✅ Get all leaves
  async getAllLeaves() {
    try {
      // ✅ 1. Get leaves
      const leavesRes = await this.dynamo
        .getClient()
        .send(new ScanCommand({ TableName: 'Leaves' }));

      const leaves = leavesRes.Items || [];

      if (leaves.length === 0) return [];

      console.log('📥 Leaves:', leaves.length);

      // ✅ 2. Collect IDs (normalize to string)
      const userIds = [...new Set(leaves.map((l) => String(l.userId)))];

      const typeIds = [...new Set(leaves.map((l) => String(l.typeId)))];

      // ✅ 3. Batch get users (safe check)
      let users: any[] = [];
      if (userIds.length > 0) {
        const usersRes = await this.dynamo.getClient().send(
          new BatchGetCommand({
            RequestItems: {
              Users: {
                Keys: userIds.map((id) => ({ id })),
              },
            },
          }),
        );

        users = usersRes.Responses?.Users || [];
      }

      // ✅ 4. Batch get types (safe check)
      let types: any[] = [];
      if (typeIds.length > 0) {
        const typesRes = await this.dynamo.getClient().send(
          new BatchGetCommand({
            RequestItems: {
              LeaveTypes: {
                Keys: typeIds.map((id) => ({ id })),
              },
            },
          }),
        );

        types = typesRes.Responses?.LeaveTypes || [];
      }

      // ✅ 5. Create lookup maps (string-safe)
      const userMap = new Map(users.map((u) => [String(u.id), u]));

      const typeMap = new Map(types.map((t) => [String(t.id), t]));

      // ✅ 6. Merge (safe + clean)
      const result = leaves.map((leave) => {
        const user = userMap.get(String(leave.userId)) || null;
        const type = typeMap.get(String(leave.typeId)) || null;

        return {
          ...leave,
          user,
          type,
        };
      });

      return result;
    } catch (err) {
      console.error('❌ Error fetching leaves:', err);
      throw new InternalServerErrorException('Failed to fetch leaves');
    }
  }

  // ✅ Get by ID
  async getLeaveById(id: string) {
    try {
      const leaveId = String(id);

      // ✅ 1. Get Leave
      const leaveRes = await this.dynamo.getClient().send(
        new GetCommand({
          TableName: 'Leaves',
          Key: { id: leaveId },
        }),
      );

      const leave = leaveRes.Item;

      if (!leave) return null;

      // ✅ 2. Get User + Type using BatchGet
      const batchRes = await this.dynamo.getClient().send(
        new BatchGetCommand({
          RequestItems: {
            Users: {
              Keys: [{ id: String(leave.userId) }],
            },
            LeaveTypes: {
              Keys: [{ id: String(leave.typeId) }],
            },
          },
        }),
      );

      const user = batchRes.Responses?.Users?.[0] || null;

      const type = batchRes.Responses?.LeaveTypes?.[0] || null;

      // ✅ 3. Get Logs (if stored separately)
      // const logsRes = await this.dynamo.getClient().send(
      //   new QueryCommand({
      //     TableName: 'LeaveLogs',
      //     KeyConditionExpression: 'leaveId = :leaveId',
      //     ExpressionAttributeValues: {
      //       ':leaveId': leaveId,
      //     },
      //   }),
      // );

      // const logs = logsRes.Items || [];

      // ✅ 4. Merge all
      return {
        ...leave,
        user,
        type,
        // logs,
      };
    } catch (err) {
      console.error('❌ Error fetching leave by ID:', err);
      throw new InternalServerErrorException('Failed to fetch leave');
    }
  }

  // ✅ Approve / Reject Leave
  async updateLeaveStatus(
    id: string,
    body: {
      status: 'APPROVED' | 'REJECTED' | 'PENDING';
      approvedBy?: string;
      rejectionReason?: string;
    },
  ) {
    const dynamoClient = this.dynamo.getClient();

    let oldLeave: any = null;

    try {
      // ====================================
      // ✅ STEP 1: Get existing leave (for rollback)
      // ====================================
      const leaveRes = await dynamoClient.send(
        new GetCommand({
          TableName: 'Leaves',
          Key: { id: String(id) },
        }),
      );

      if (!leaveRes.Item) {
        throw new BadRequestException('Leave not found');
      }

      oldLeave = leaveRes.Item;

      const updatedAt = new Date().toISOString();

      // ====================================
      // ✅ STEP 2: Update Dynamo (PRIMARY)
      // ====================================
      await dynamoClient.send(
        new UpdateCommand({
          TableName: 'Leaves',
          Key: { id: String(id) },
          UpdateExpression:
            'SET #status = :status, #approvedBy = :approvedBy, #rejectionReason = :rejectionReason, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#approvedBy': 'approvedBy',
            '#rejectionReason': 'rejectionReason',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':status': body.status,
            ':approvedBy': body.approvedBy || '',
            ':rejectionReason': body.rejectionReason || '',
            ':updatedAt': updatedAt,
          },
        }),
      );

      // ====================================
      // ✅ STEP 3: Deduct balance in Dynamo
      // ====================================
      if (body.status === 'APPROVED') {
        const year = new Date(oldLeave.startDate).getFullYear();

        await dynamoClient.send(
          new UpdateCommand({
            TableName: 'LeaveBalances',
            Key: {
              userId: String(oldLeave.userId),
              typeId: String(oldLeave.typeId),
              year: String(year),
            },
            UpdateExpression:
              'SET #used = #used + :used, #remaining = #remaining - :remaining',
            ExpressionAttributeNames: {
              '#used': 'used',
              '#remaining': 'remaining',
            },
            ExpressionAttributeValues: {
              ':used': oldLeave.totalDays,
              ':remaining': oldLeave.totalDays,
            },
            // ✅ Prevent negative balance (IMPORTANT)
            ConditionExpression: '#remaining >= :remaining',
          }),
        );
      }

      // ====================================
      // ✅ STEP 4: Sync to RDS
      // ====================================
      let updatedLeave;

      try {
        updatedLeave = await this.prisma.leave.update({
          where: { id },
          data: {
            status: body.status,
            approvedBy: body.approvedBy,
            rejectionReason: body.rejectionReason,
          },
        });

        if (body.status === 'APPROVED') {
          await this.prisma.leaveBalance.updateMany({
            where: {
              userId: oldLeave.userId,
              typeId: oldLeave.typeId,
              year: new Date(oldLeave.startDate).getFullYear(),
            },
            data: {
              used: { increment: oldLeave.totalDays },
              remaining: { decrement: oldLeave.totalDays },
            },
          });
        }
      } catch (rdsError) {
        console.error('❌ RDS sync failed:', rdsError);

        // ====================================
        // ❗ ROLLBACK Dynamo
        // ====================================
        await dynamoClient.send(
          new PutCommand({
            TableName: 'Leaves',
            Item: oldLeave,
          }),
        );

        // rollback balance if deducted
        if (body.status === 'APPROVED') {
          const year = new Date(oldLeave.startDate).getFullYear();

          await dynamoClient.send(
            new UpdateCommand({
              TableName: 'LeaveBalances',
              Key: {
                userId: String(oldLeave.userId),
                typeId: String(oldLeave.typeId),
                year: String(year),
              },
              UpdateExpression:
                'SET #used = #used - :used, #remaining = #remaining + :remaining',
              ExpressionAttributeNames: {
                '#used': 'used',
                '#remaining': 'remaining',
              },
              ExpressionAttributeValues: {
                ':used': oldLeave.totalDays,
                ':remaining': oldLeave.totalDays,
              },
            }),
          );
        }

        throw new InternalServerErrorException('Failed to sync with RDS');
      }

      return updatedLeave;
    } catch (error) {
      console.error(error);

      if (error instanceof BadRequestException) throw error;

      throw new InternalServerErrorException('Failed to update leave status');
    }
  }
}
