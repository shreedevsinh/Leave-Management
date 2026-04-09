import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DynamoService } from 'src/dynamo/dynamo.service';
import {
  PutCommand,
  ScanCommand,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  BatchGetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private dynamo: DynamoService,
  ) {}

  async getMonthlyPayroll(month: number, year: number) {
    const client = this.dynamo.getClient();

    const payroll = await client.send(
      new ScanCommand({
        TableName: 'Payrolls',

        FilterExpression: '#y = :year AND #m = :month',

        ExpressionAttributeNames: {
          '#m': 'month',
          '#y': 'year',
        },

        ExpressionAttributeValues: {
          ':month': Number(month), // ✅ FIXED
          ':year': Number(year), // ✅ FIXED
        },
      }),
    );

    const payrolls = payroll.Items || [];
    if (!payrolls.length) return [];

    // 2️⃣ Extract unique userIds
    const userIds = [...new Set(payrolls.map((p) => p.userId).filter(Boolean))];

    // 3️⃣ Fetch users in batch
    const usersRes = await client.send(
      new BatchGetCommand({
        RequestItems: {
          Users: {
            Keys: userIds.map((id) => ({ id })),
          },
        },
      }),
    );

    const users = usersRes.Responses?.Users || [];

    // 4️⃣ Create user map
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    // 5️⃣ Merge payroll + user
    const result = payrolls.map((p) => ({
      ...p,
      user: userMap[p.userId] || null,
    }));

    return result;
  }

  /* =========================================================
      MAIN FUNCTION
  ========================================================= */
  async generateMonthlyPayroll(month: number, year: number) {
    month = Number(month);
    year = Number(year);

    const client = this.dynamo.getClient();

    const workingDays = await this.calculateWorkingDays(month, year);

    const users = await this.getActiveEmployees(client);
    if (!users.length) return [];

    const payroll = await Promise.all(
      users.map(async (user) => {
        const attendance = await this.getMonthlyAttendance(
          user.id,
          month,
          year,
        );

        // 🔥 shared calculation
        const stats = await this.buildAttendanceStats(client, attendance);

        const salaryData = user.isHourly
          ? this.calculateHourlySalary(user, stats, workingDays, attendance)
          : this.calculateDailySalary(user, stats, workingDays, attendance);

        const payrollItem = {
          id: `${user.id}-${year}-${month}`,
          month,
          year,
          ...salaryData,
          createdAt: new Date().toISOString(),
        };

        const existingPayroll = await this.getPayroll(
          client,
          user.id,
          month,
          year,
        );
        if (existingPayroll) {
          await client.send(
            new UpdateCommand({
              TableName: 'Payrolls',
              Key: { id: `${user.id}-${year}-${month}` },

              UpdateExpression: `
                SET 
                  #salary = :salary,
                  #type = :type,
                  totalWorkedHours = :twh,
                  totalWorkingHoursForMonth = :twhm,
                  totalOvertime = :ot,
                  paidDays = :pd,
                  paidHours = :ph,
                  efficiency = :eff,
                  workingDays = :workingDays,
                  updatedAt = :updatedAt,
                  leaveDays = :leaveDays,
                  baseSalary = :baseSalary
              `,

              ExpressionAttributeNames: {
                '#salary': 'salary',
                '#type': 'type',
              },

              ExpressionAttributeValues: {
                ':salary': payrollItem.salary,
                ':type': payrollItem.type,
                ':baseSalary': payrollItem.baseSalary,
                ':twh': payrollItem.paidHours || 0,
                ':twhm': payrollItem.totalWorkingHoursForMonth || 0,
                ':ot': payrollItem.totalOvertime || 0,
                ':pd': payrollItem.paidDays || 0,
                ':leaveDays': payrollItem.leaveDays || 0,
                ':ph': payrollItem.paidHours || 0,
                ':eff': payrollItem.efficiency || 0,
                ':workingDays': payrollItem.workingDays || 0,
                ':updatedAt': new Date().toISOString(),
              },
            }),
          );
        } else {
          await client.send(
            new PutCommand({
              TableName: 'Payrolls',
              Item: payrollItem,
              ConditionExpression: 'attribute_not_exists(id)',
            }),
          );
        }

        return payrollItem;
      }),
    );

    return payroll;
  }

  /* =========================================================
      COMMON HELPERS
  ========================================================= */

  async getActiveEmployees(client: any) {
    const res = await client.send(
      new ScanCommand({
        TableName: 'Users',
        FilterExpression: '#isActive = :isActive AND #role = :role',
        ExpressionAttributeNames: {
          '#isActive': 'isActive',
          '#role': 'role',
        },
        ExpressionAttributeValues: {
          ':isActive': true,
          ':role': 'EMPLOYEE',
        },
      }),
    );

    return res.Items || [];
  }

  async getMonthlyAttendance(userId: string, month: number, year: number) {
    const client = this.dynamo.getClient();

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

    const res = await client.send(
      new QueryCommand({
        TableName: 'Attendance',
        IndexName: 'userId-date-index',
        KeyConditionExpression:
          '#userId = :userId AND #date BETWEEN :start AND :end',
        ExpressionAttributeNames: {
          '#userId': 'userId',
          '#date': 'date',
        },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':start': startDate,
          ':end': endDate,
        },
      }),
    );

    return res.Items || [];
  }

  /* =========================================================
      🔥 REUSABLE CORE LOGIC
  ========================================================= */

  async buildAttendanceStats(client: any, attendance: any[]) {
    if (!attendance.length) {
      return {
        totalWorkedHours: 0,
        totalWorkingHoursForMonth: 0,
        totalOvertime: 0,
        officeTimingMap: {},
      };
    }

    const officeTimingIds = [
      ...new Set(attendance.map((a) => a.officeTimingId).filter(Boolean)),
    ];

    let officeTimingMap: Record<string, any> = {};

    if (officeTimingIds.length) {
      const res = await client.send(
        new BatchGetCommand({
          RequestItems: {
            OfficeTiming: {
              Keys: officeTimingIds.map((id) => ({ id })),
            },
          },
        }),
      );

      officeTimingMap = Object.fromEntries(
        (res.Responses?.OfficeTiming || []).map((i) => [i.id, i]),
      );
    }

    const isSingleTiming = officeTimingIds.length === 1;
    const defaultWorkingHours = isSingleTiming
      ? officeTimingMap[officeTimingIds[0]]?.workingHours || 0
      : null;

    let totalWorkedHours = 0;
    let totalWorkingHoursForMonth = 0;
    let totalOvertime = 0;

    for (const day of attendance) {
      const worked = day.workingHours || 0;
      const overtime = day.overtimeHours || 0;

      const expected =
        defaultWorkingHours ??
        officeTimingMap[day.officeTimingId]?.workingHours ??
        0;

      totalWorkedHours += worked;
      totalWorkingHoursForMonth += expected;
      totalOvertime += overtime;
    }

    return {
      totalWorkedHours,
      totalWorkingHoursForMonth,
      totalOvertime,
      officeTimingMap,
    };
  }

  /* =========================================================
      SALARY CALCULATIONS
  ========================================================= */

  private calculateHourlySalary(
    user: any,
    stats: any,
    workingDays: number,
    attendance: any[],
  ) {
    const { totalWorkedHours, totalWorkingHoursForMonth, totalOvertime } =
      stats;

    if (!attendance.length) {
      return {
        userId: user.id,
        type: 'HOURLY',
        totalWorkedHours: 0,
        totalWorkingHoursForMonth: 0,
        overtimeHours: 0,
        salary: 0,
      };
    }

    const hourlyRate =
      ((user.salary / workingDays) * attendance.length) /
      (totalWorkingHoursForMonth || 1);

    const salary = totalWorkedHours * hourlyRate;

    const efficiency = totalWorkingHoursForMonth
      ? (totalWorkedHours / totalWorkingHoursForMonth) * 100
      : 0;

    return {
      userId: user.id,
      type: 'HOURLY',

      workingDays,

      paidHours: +totalWorkedHours.toFixed(2),
      totalWorkingHoursForMonth: +totalWorkingHoursForMonth.toFixed(2),
      totalOvertime: +totalOvertime.toFixed(2) || 0,

      paidDays: attendance.filter((d) =>
        ['PRESENT', 'HALF_DAY'].includes(d.status),
      ).length,
      leaveDays: attendance.filter((d) => d.status === 'ABSENT').length || 0,

      efficiency: +efficiency.toFixed(2),
      baseSalary: user.salary,
      salary: +salary.toFixed(2),
    };
  }

  private calculateDailySalary(
    user: any,
    stats: any,
    workingDays: number,
    attendance: any[],
  ) {
    const { totalWorkedHours, totalWorkingHoursForMonth, totalOvertime } =
      stats;

    const presentDays = attendance.filter((d) => d.status === 'PRESENT').length;

    const halfDays = attendance.filter((d) => d.status === 'HALF_DAY').length;

    const paidDays = presentDays + halfDays;

    const perDaySalary = workingDays ? user.salary / workingDays : 0;

    const salary = presentDays * perDaySalary + halfDays * perDaySalary * 0.5;

    const efficiency = workingDays
      ? ((presentDays + halfDays * 0.5) / workingDays) * 100
      : 0;

    return {
      userId: user.id,
      type: 'DAILY',
      workingDays,

      totalWorkingHoursForMonth: +totalWorkingHoursForMonth.toFixed(2),
      totalOvertime: +totalOvertime.toFixed(2),

      paidHours: +totalWorkedHours.toFixed(2),
      paidDays: paidDays,
      leaveDays: attendance.filter((d) => d.status === 'ABSENT').length || 0,

      efficiency: +efficiency.toFixed(2),
      baseSalary: user.salary,
      salary: +salary.toFixed(2),
    };
  }

  private calculateWorkingDays(month: number, year: number) {
    let workingDays = 0;
    const totalDays = new Date(year, month, 0).getDate();
    for (let d = 1; d <= totalDays; d++) {
      const day = new Date(year, month - 1, d).getDay();
      if (day !== 0 && day !== 6) workingDays++;
    }
    return workingDays;
  }

  private async getPayroll(
    client,
    userId: string,
    month: number,
    year: number,
  ) {
    const res = await client.send(
      new QueryCommand({
        TableName: 'Payrolls',
        IndexName: 'userId-year-month-index',
        KeyConditionExpression: 'userId = :u AND #yr = :y',
        FilterExpression: '#m = :m',
        ExpressionAttributeNames: { '#yr': 'year', '#m': 'month' },
        ExpressionAttributeValues: { ':u': userId, ':y': year, ':m': month },
      }),
    );
    return res.Items?.[0];
  }
}
