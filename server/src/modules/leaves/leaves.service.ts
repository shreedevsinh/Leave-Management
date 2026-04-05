import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
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
    console.log('🔹 resolveLeaveSplitDynamo:start', {
      userId,
      typeId,
      year,
      days,
    });

    const dynamoClient = this.dynamo.getClient();

    console.log('📥 Fetching LeaveType...');
    const typeRes = await dynamoClient.send(
      new GetCommand({
        TableName: 'LeaveTypes',
        Key: { id: String(typeId) },
      }),
    );

    console.log('📦 LeaveType result', typeRes.Item);

    if (!typeRes.Item) {
      console.log('❌ Invalid leave type');
      throw new BadRequestException('Invalid leave type');
    }

    const type = typeRes.Item;

    console.log('📥 Fetching LeaveBalance...');
    const balanceRes = await dynamoClient.send(
      new ScanCommand({
        TableName: 'LeaveBalances',
        FilterExpression:
          '#userId = :userId AND #typeId = :typeId AND #year = :year',
        ExpressionAttributeNames: {
          '#userId': 'userId',
          '#typeId': 'typeId',
          '#year': 'year',
        },
        ExpressionAttributeValues: {
          ':userId': String(userId),
          ':typeId': String(typeId),
          ':year': String(year),
        },
      }),
    );

    let balance = balanceRes.Items?.[0];

    if (!balance) {
      console.log('🆕 Creating new balance');

      balance = {
        id: uuidv4(),
        userId: String(userId),
        typeId: String(typeId),
        year: Number(year),
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

      console.log('✅ Balance created', balance);
    }

    if (balance.remaining >= days) {
      console.log('✅ Enough balance', { remaining: balance.remaining });
      return [{ typeId, days }];
    }

    console.log('⚠️ Partial balance, splitting required');

    const result: { typeId: string; days: number }[] = [];

    if (balance.remaining > 0) {
      result.push({ typeId, days: balance.remaining });
    }

    console.log('🔍 Searching Paid Leave type...');
    const paidLeaveRes = await dynamoClient.send(
      new ScanCommand({
        TableName: 'LeaveTypes',
        FilterExpression: '#name = :name',
        ExpressionAttributeNames: { '#name': 'name' },
        ExpressionAttributeValues: { ':name': 'Paid Leave' },
      }),
    );

    console.log('📦 Paid leave result', paidLeaveRes.Items);

    const paidLeaveType = paidLeaveRes.Items?.[0];

    if (!paidLeaveType) {
      console.log('❌ Paid leave not found');
      throw new BadRequestException('Paid Leave type not configured');
    }

    result.push({
      typeId: paidLeaveType.id,
      days: days - balance.remaining,
    });

    console.log('✅ Final split result', result);

    return result;
  }

  // ✅ Create Leave
  async createLeave(data: CreateLeaveDto) {
    console.log('🚀 createLeave called with data:', JSON.stringify(data));

    const { userId, typeId, startDate, endDate, reason, status } = data;

    const start = new Date(startDate);
    const end = new Date(endDate);

    console.log('📅 Parsed Dates:', {
      start: start.toISOString(),
      end: end.toISOString(),
    });

    if (end < start) {
      console.error('❌ Invalid date range');
      throw new BadRequestException('End date cannot be before start date');
    }

    const segments = this.splitLeaveByYear(start, end);
    console.log('🧩 Segments:', JSON.stringify(segments));

    const dynamoClient = this.dynamo.getClient();
    console.log('📦 Dynamo client initialized');

    const createdLeaves: any[] = [];

    try {
      // ====================================
      // ✅ 1. Check overlap
      // ====================================
      console.log('🔍 Checking overlap in Dynamo...');

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

      console.log('🔍 Overlap result:', JSON.stringify(overlapRes.Items));

      if (overlapRes.Items?.length) {
        console.error('❌ Leave overlap detected');
        throw new BadRequestException('Leave already exists');
      }

      // ====================================
      // ✅ 2. Create leaves in Dynamo
      // ====================================
      console.log('🛠 Creating leaves in Dynamo...');

      for (const segment of segments) {
        console.log('➡️ Processing segment:', JSON.stringify(segment));

        const days = this.calculateDays(segment.start, segment.end);
        console.log('📊 Calculated days:', days);

        const splits = await this.resolveLeaveSplitDynamo(
          userId,
          typeId,
          segment.year,
          days,
        );

        console.log('🔀 Leave splits:', JSON.stringify(splits));

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

          console.log('📤 Putting item to Dynamo:', JSON.stringify(item));

          await dynamoClient.send(
            new PutCommand({
              TableName: 'Leaves',
              Item: item,
            }),
          );

          console.log('✅ Dynamo insert success:', leaveId);

          createdLeaves.push(item);
        }
      }

      // ====================================
      // ✅ 3. Sync to RDS
      // ====================================
      console.log('🔄 Syncing to RDS...');

      try {
        await Promise.all(
          createdLeaves.map((leave) => {
            console.log('📥 Syncing leave to RDS:', leave.id);

            return this.prisma.leave.create({
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
            });
          }),
        );

        console.log('✅ RDS sync completed');
      } catch (err) {
        console.error('❌ RDS sync failed:', err);
      }

      // ====================================
      // ✅ 4. Auto approve
      // ====================================
      if (status === 'APPROVED') {
        console.log('⚡ Auto-approving leaves...');

        for (const leave of createdLeaves) {
          console.log('✅ Approving leave:', leave.id);

          await this.updateLeaveStatus(leave.id, {
            status: 'APPROVED',
            approvedBy: userId,
          });
        }
      }

      console.log(
        '🎉 Leave creation successful:',
        JSON.stringify(createdLeaves),
      );

      return createdLeaves;
    } catch (error: any) {
      console.error('🔥 ERROR in createLeave:', error);

      // ====================================
      // ❗ Rollback Dynamo
      // ====================================
      console.log('↩️ Rolling back Dynamo entries...');

      await Promise.all(
        createdLeaves.map((l) => {
          console.log('🗑 Deleting item:', l.id);

          return dynamoClient.send(
            new DeleteCommand({
              TableName: 'Leaves',
              Key: { id: l.id },
            }),
          );
        }),
      );

      console.log('✅ Rollback completed');

      throw new InternalServerErrorException(
        error?.message || 'Failed to create leave',
      );
    }
  }

  async getAllLeaves(
    limit = 10,
    lastKey?: any,
    employee?: string,
    startDate?: string,
    endDate?: string,
    status?: string,
  ) {
    try {
      let filterExpressions: string[] = [];
      let expressionValues: any = {};
      let expressionNames: any = {};

      // ✅ Employee filter
      if (employee) {
        filterExpressions.push('#userId = :employee');
        expressionValues[':employee'] = employee;
        expressionNames['#userId'] = 'userId';
      }

      // ✅ Status filter
      if (status && status !== 'ALL') {
        filterExpressions.push('#status = :status');
        expressionValues[':status'] = status.toUpperCase();
        expressionNames['#status'] = 'status';
      }

      // ✅ Date filter
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const minDate = start < end ? start : end;
        const maxDate = start > end ? start : end;

        filterExpressions.push('#startDate BETWEEN :start AND :end');
        expressionValues[':start'] = minDate.toISOString();
        expressionValues[':end'] = maxDate.toISOString();
        expressionNames['#startDate'] = 'startDate';
      }

      // ================================
      // 🔥 1. FULL SCAN → STATUS COUNTS
      // ================================
      let statusCounts = {
        pending: 0,
        approved: 0,
        rejected: 0,
      };

      let scanKey: any = undefined;

      const seenIds = new Set(); // 🔥 prevent duplicates

      do {
        const params: any = {
          TableName: 'Leaves',
          ExclusiveStartKey: scanKey,
          ConsistentRead: true, // 🔥 ensures consistent data
        };

        if (filterExpressions.length > 0) {
          params.FilterExpression = filterExpressions.join(' AND ');
          params.ExpressionAttributeValues = expressionValues;
          params.ExpressionAttributeNames = expressionNames;
        }

        const res = await this.dynamo.getClient().send(new ScanCommand(params));

        const items = res.Items || [];

        for (const l of items) {
          const id = String(l.id); // 🔥 unique identifier

          // console.log('🔍 Processing leave for status count:', l.status);
          // ✅ skip duplicates
          if (seenIds.has(id)) continue;
          seenIds.add(id);

          // ✅ optimized condition
          if (l.status === 'PENDING') statusCounts.pending++;
          else if (l.status === 'APPROVED') statusCounts.approved++;
          else if (l.status === 'REJECTED') statusCounts.rejected++;
          else {
            console.error('❌ Invalid status:', l.status);
          }
        }

        scanKey = res.LastEvaluatedKey;
      } while (scanKey);

      // ================================
      // 🔥 2. PAGINATED SCAN
      // ================================
      let collected: any[] = [];
      let lastEvaluatedKey = lastKey || undefined;

      do {
        const params: any = {
          TableName: 'Leaves',
          Limit: limit,
          ExclusiveStartKey: lastEvaluatedKey,
        };

        if (filterExpressions.length > 0) {
          params.FilterExpression = filterExpressions.join(' AND ');
          params.ExpressionAttributeValues = expressionValues;
          params.ExpressionAttributeNames = expressionNames;
        }

        const res = await this.dynamo.getClient().send(new ScanCommand(params));

        const items = res.Items || [];
        collected.push(...items);

        lastEvaluatedKey = res.LastEvaluatedKey;
      } while (collected.length < limit && lastEvaluatedKey);

      const paginatedItems = collected.slice(0, limit);

      // ================================
      // 🔥 3. TOTAL COUNT
      // ================================
      const countParams: any = {
        TableName: 'Leaves',
        Select: 'COUNT',
      };

      if (filterExpressions.length > 0) {
        countParams.FilterExpression = filterExpressions.join(' AND ');
        countParams.ExpressionAttributeValues = expressionValues;
        countParams.ExpressionAttributeNames = expressionNames;
      }

      const countRes = await this.dynamo
        .getClient()
        .send(new ScanCommand(countParams));

      const totalCount = countRes.Count || 0;

      if (paginatedItems.length === 0) {
        return {
          items: [],
          lastKey: null,
          totalCount,
          totalPages: 0,
          pending: statusCounts.pending,
          approved: statusCounts.approved,
          rejected: statusCounts.rejected,
        };
      }

      // ================================
      // 🔥 4. RELATIONS (Users + Types)
      // ================================
      const userIds = [...new Set(paginatedItems.map((l) => String(l.userId)))];
      const typeIds = [...new Set(paginatedItems.map((l) => String(l.typeId)))];

      let users: any[] = [];
      let types: any[] = [];

      if (userIds.length > 0) {
        const res = await this.dynamo.getClient().send(
          new BatchGetCommand({
            RequestItems: {
              Users: { Keys: userIds.map((id) => ({ id })) },
            },
          }),
        );
        users = res.Responses?.Users || [];
      }

      if (typeIds.length > 0) {
        const res = await this.dynamo.getClient().send(
          new BatchGetCommand({
            RequestItems: {
              LeaveTypes: { Keys: typeIds.map((id) => ({ id })) },
            },
          }),
        );
        types = res.Responses?.LeaveTypes || [];
      }

      const userMap = new Map(users.map((u) => [String(u.id), u]));
      const typeMap = new Map(types.map((t) => [String(t.id), t]));

      const mergedLeaves = paginatedItems.map((leave) => ({
        ...leave,
        user: userMap.get(String(leave.userId)) || null,
        type: typeMap.get(String(leave.typeId)) || null,
      }));

      // ================================
      // ✅ FINAL RESPONSE
      // ================================
      return {
        items: mergedLeaves,
        lastKey: lastEvaluatedKey || null,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        pending: statusCounts.pending,
        approved: statusCounts.approved,
        rejected: statusCounts.rejected,
      };
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to fetch leaves');
    }
  }

  async getLeavesByMonth(month: string, year: string) {
    try {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 0, 23, 59, 59);

      const client = this.dynamo.getClient();

      // ================================
      // 🔥 1. GET LEAVES
      // ================================
      const res = await client.send(
        new ScanCommand({
          TableName: 'Leaves',
          FilterExpression: '#startDate <= :end AND #endDate >= :start',
          ExpressionAttributeNames: {
            '#startDate': 'startDate',
            '#endDate': 'endDate',
          },
          ExpressionAttributeValues: {
            ':start': start.toISOString(),
            ':end': end.toISOString(),
          },
        }),
      );

      const leaves = res.Items || [];

      if (leaves.length === 0) {
        return [];
      }

      // ================================
      // 🔥 2. GET UNIQUE IDS
      // ================================
      const userIds = [...new Set(leaves.map((l) => String(l.userId)))];

      const typeIds = [...new Set(leaves.map((l) => String(l.typeId)))];

      // ================================
      // 🔥 3. FETCH USERS
      // ================================
      let users: any[] = [];
      if (userIds.length > 0) {
        const userRes = await client.send(
          new BatchGetCommand({
            RequestItems: {
              Users: {
                Keys: userIds.map((id) => ({ id })),
              },
            },
          }),
        );
        users = userRes.Responses?.Users || [];
      }

      // ================================
      // 🔥 4. FETCH LEAVE TYPES
      // ================================
      let types: any[] = [];
      if (typeIds.length > 0) {
        const typeRes = await client.send(
          new BatchGetCommand({
            RequestItems: {
              LeaveTypes: {
                Keys: typeIds.map((id) => ({ id })),
              },
            },
          }),
        );
        types = typeRes.Responses?.LeaveTypes || [];
      }

      // ================================
      // 🔥 5. MAP DATA
      // ================================
      const userMap = new Map(users.map((u) => [String(u.id), u]));
      const typeMap = new Map(types.map((t) => [String(t.id), t]));

      const mergedLeaves = leaves.map((leave) => ({
        ...leave,
        user: userMap.get(String(leave.userId)) || null,
        type: typeMap.get(String(leave.typeId)) || null,
      }));

      // ================================
      // ✅ FINAL RESPONSE
      // ================================
      return mergedLeaves;
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to fetch leaves');
    }
  }

  // ✅ Get by ID
  async getLeaveById(id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Leave ID must be provided');
    }

    try {
      const res = await this.dynamo.getClient().send(
        new GetCommand({
          TableName: 'Leaves',
          Key: { id }, // id must be non-empty
        }),
      );

      if (!res.Item) {
        throw new NotFoundException(`Leave not found with id ${id}`);
      }

      return res.Item;
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
