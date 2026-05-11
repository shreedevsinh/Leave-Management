import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DynamoService } from '../../dynamo/dynamo.service';
import {
  PutCommand,
  UpdateCommand,
  ScanCommand,
  GetCommand,
  BatchGetCommand,
  DeleteCommand,
  QueryCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { CreateLeaveDto } from './dto/create-leave.dto';

@Injectable()
export class LeavesService {
  constructor(private dynamo: DynamoService) {}

  // ✅ Utility: calculate days
  private calculateDays(start: Date, end: Date): number {
    const s = new Date(start);
    const e = new Date(end);

    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);

    const diff = e.getTime() - s.getTime();

    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  }

  private getTTLInSeconds(years = 2) {
    const now = Math.floor(Date.now() / 1000);
    const secondsInYear = 365 * 24 * 60 * 60;

    return now + years * secondsInYear;
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

    const typeRes = await dynamoClient.send(
      new GetCommand({
        TableName: 'LeaveTypes',
        Key: { id: String(typeId) },
      }),
    );

    if (!typeRes.Item) {
      throw new BadRequestException('Invalid leave type');
    }

    const type = typeRes.Item;

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
      balance = {
        id: uuidv4(),
        userId: String(userId),
        typeId: String(typeId),
        year: Number(year),
        total: type.maxPerYear,
        used: 0,
        remaining: type.maxPerYear,
        expiresAt: this.getTTLInSeconds(2).toString(),
      };

      await dynamoClient.send(
        new PutCommand({
          TableName: 'LeaveBalances',
          Item: balance,
        }),
      );
    }

    if (balance.remaining >= days) {
      return [{ typeId, days }];
    }

    const result: { typeId: string; days: number }[] = [];

    if (balance.remaining > 0) {
      result.push({ typeId, days: balance.remaining });
    }

    const paidLeaveRes = await dynamoClient.send(
      new ScanCommand({
        TableName: 'LeaveTypes',
        FilterExpression: '#name = :name',
        ExpressionAttributeNames: { '#name': 'name' },
        ExpressionAttributeValues: { ':name': 'Paid Leave' },
      }),
    );

    const paidLeaveType = paidLeaveRes.Items?.[0];

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
  async createLeave(data: CreateLeaveDto) {
    const { userId, typeId, startDate, endDate, reason, status } = data;

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      console.error('❌ Invalid date range');
      throw new BadRequestException('End date cannot be before start date');
    }

    const segments = this.splitLeaveByYear(start, end);

    const dynamoClient = this.dynamo.getClient();

    const createdLeaves: any[] = [];

    try {
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
        console.error('❌ Leave overlap detected');
        throw new BadRequestException('Leave already exists');
      }

      for (const segment of segments) {
        const days = this.calculateDays(segment.start, segment.end);

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
            expiresAt: this.getTTLInSeconds(2).toString(),
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
    } catch (error: any) {
      console.error('🔥 ERROR in createLeave:', error);

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
    let oldLeave: any;

    try {
      // ====================================
      // 1. FETCH LEAVE (SOURCE OF TRUTH)
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
      const year = new Date(oldLeave.startDate).getFullYear();

      // ====================================
      // 2. UPDATE LEAVE (DYNAMO PRIMARY)
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
      // 3. APPROVAL LOGIC (BALANCE + ATTENDANCE)
      // ====================================
      if (body.status === 'APPROVED') {
        // 3.1 Get LeaveBalance via GSI (IMPORTANT FIX)
        const balanceRes = await dynamoClient.send(
          new QueryCommand({
            TableName: 'LeaveBalances',
            IndexName: 'user-year-index',
            KeyConditionExpression: 'userId = :u AND #year = :y',
            ExpressionAttributeNames: {
              '#year': 'year',
            },
            ExpressionAttributeValues: {
              ':u': String(oldLeave.userId),
              ':y': Number(year),
            },
          }),
        );

        const balance = balanceRes.Items?.[0];

        if (!balance) {
          throw new Error('Leave balance not found');
        }

        // 3.2 Update Leave Balance safely
        try {
          await dynamoClient.send(
            new UpdateCommand({
              TableName: 'LeaveBalances',
              Key: { id: balance.id },
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
              ConditionExpression: '#remaining >= :remaining',
            }),
          );
        } catch (err) {
          console.error('❌ Error updating leave balance:', err);
        }

        // 3.3 Create Attendance (Dynamo)
        const start = new Date(oldLeave.startDate);
        const end = new Date(oldLeave.endDate);

        const attendanceClient = this.dynamo.getClient();

        const attendanceItems: any[] = [];

        while (start <= end) {
          const date = new Date(start.getTime() + 1000 * 60 * 60 * 24);
          const dateStr = date.toISOString().split('T')[0];

          // ✅ 1. Get active office timing
          const officeTime = await attendanceClient.send(
            new ScanCommand({
              TableName: 'OfficeTiming',
              FilterExpression: '#isActive = :isActive',
              ExpressionAttributeNames: {
                '#isActive': 'isActive',
              },
              ExpressionAttributeValues: {
                ':isActive': true,
              },
            }),
          );

          // ✅ 2. Check if attendance exists
          const existing = await attendanceClient.send(
            new QueryCommand({
              TableName: 'Attendance',
              IndexName: 'userId-date-index', // ✅ IMPORTANT

              KeyConditionExpression: '#userId = :userId AND #date = :date',

              ExpressionAttributeNames: {
                '#userId': 'userId',
                '#date': 'date',
              },

              ExpressionAttributeValues: {
                ':userId': String(oldLeave.userId),
                ':date': dateStr,
              },
            }),
          );

          if (existing.Items && existing.Items.length > 0) {
            const record = existing.Items?.[0];

            // ✅ UPDATE
            await attendanceClient.send(
              new UpdateCommand({
                TableName: 'Attendance',
                Key: {
                  id: record.id, // ✅ ONLY PRIMARY KEY
                },
                UpdateExpression:
                  'SET #status = :status, #note = :note, updatedAt = :updatedAt',
                ExpressionAttributeNames: {
                  '#status': 'status',
                  '#note': 'note',
                },
                ExpressionAttributeValues: {
                  ':status': 'ABSENT',
                  ':note': 'Leave Approved',
                  ':updatedAt': new Date().toISOString(),
                },
              }),
            );
          } else {
            // ✅ CREATE
            await attendanceClient.send(
              new PutCommand({
                TableName: 'Attendance',
                Item: {
                  id: uuidv4(),
                  userId: String(oldLeave.userId),
                  date: dateStr,
                  checkIn: null,
                  checkOut: null,
                  workingHours: 0,
                  lateHours: 0,
                  earlyLeave: 0,
                  overtimeHours: 0,
                  status: 'ABSENT',
                  note: 'Leave Approved',
                  officeTimingId: officeTime.Items?.[0]?.id,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  expiresAt: this.getTTLInSeconds(2).toString(),
                },
              }),
            );
          }

          start.setDate(start.getDate() + 1);
        }

        // safer batch write (better than loop)
        if (attendanceItems.length) {
          await attendanceClient.send(
            new BatchWriteCommand({
              RequestItems: {
                Attendance: attendanceItems,
              },
            }),
          );
        }
      }

      // ====================================
      // 4. SYNC RDS
      // ====================================
      let updatedLeave;

      return updatedLeave;
    } catch (error) {
      console.error('🔥 GLOBAL ERROR:', error);

      if (error instanceof BadRequestException) throw error;

      throw new InternalServerErrorException('Failed to update leave status');
    }
  }
}
