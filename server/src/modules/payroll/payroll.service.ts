import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DynamoService } from 'src/dynamo/dynamo.service';
import {
  PutCommand,
  DeleteCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private dynamo: DynamoService,
  ) {}

  async getMonthlyPayroll(month: number, year: number) {
    month = Number(month);
    year = Number(year);

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // if (month === currentMonth && year === currentYear) {
    let workingDays = 0;

    // JS month is 0-based → so month - 1
    const totalDays = new Date(year, month, 0).getDate();

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }

    const client = this.dynamo.getClient();

    // ✅ 1. Get employees
    const usersRes = await client.send(
      new ScanCommand({
        TableName: 'Users',
        FilterExpression: '#role = :role',
        ExpressionAttributeNames: {
          '#role': 'role',
        },
        ExpressionAttributeValues: {
          ':role': 'EMPLOYEE',
        },
      }),
    );

    const users = usersRes.Items || [];

    // ✅ 2. Get leaves for current month
    const startOfMonth = new Date(year, month - 1, 1).toISOString();
    const endOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

    const leavesRes = await client.send(
      new ScanCommand({
        TableName: 'Leaves',
        FilterExpression:
          '#status = :status AND #startDate BETWEEN :start AND :end',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#startDate': 'startDate',
        },
        ExpressionAttributeValues: {
          ':status': 'APPROVED',
          ':start': startOfMonth,
          ':end': endOfMonth,
        },
      }),
    );

    const leaves = leavesRes.Items || [];

    // ✅ 3. Count leaves per employee
    const leaveCountMap = {};

    for (const leave of leaves) {
      const empId = leave.userId;

      if (!leaveCountMap[empId]) {
        leaveCountMap[empId] = 0;
      }

      leaveCountMap[empId] += leave.totalDays;
    }

    // ✅ 4. Merge with users (payroll data)
    const payroll = users.map((user) => {
      return {
        employeeId: user.id,
        name: user.name,
        email: user.email,
        month,
        year,
        leaveCount: leaveCountMap[user.id] || 0,
        workingDays,
        totalDays: workingDays - (leaveCountMap[user.id] || 0),
        baseSalary: user.salary,
        finalSalary: Math.round(
          user.salary *
            ((workingDays - (leaveCountMap[user.id] || 0)) / workingDays),
        ),
      };
    });

    return payroll;
    // } else if (
    //   year < currentYear ||
    //   (year === currentYear && month < currentMonth)
    // ) {
    //   console.log('Fetching past month payroll');
    // } else {
    //   console.log('Fetching future month payroll');
    // }

    return true;
  }
}
