import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DynamoService } from '../../dynamo/dynamo.service';
import { PayrollService } from '../payroll/payroll.service';
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { stat } from 'fs';

@Injectable()
export class AttendanceService {
  constructor(
    private dynamo: DynamoService,
    private payrollService: PayrollService,
  ) {}

  private getTTLInSeconds(years = 2) {
    const now = Math.floor(Date.now() / 1000);
    const secondsInYear = 365 * 24 * 60 * 60;

    return now + years * secondsInYear;
  }

  // --------------------------
  // ✅ Check In
  // --------------------------
  async checkIn(body: { userId: string; checkInTime?: Date }) {
    const dynamoClient = this.dynamo.getClient();
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const checkInTime = body.checkInTime
      ? new Date(body.checkInTime)
      : new Date();
    let attendanceId: string | null = null;

    // Validate
    if (isNaN(checkInTime.getTime())) {
      throw new BadRequestException('Invalid check-in time');
    }

    try {
      // --------------------------
      // 1️⃣ Check if already checked in
      // --------------------------
      const existingResult = await dynamoClient.send(
        new QueryCommand({
          TableName: 'Attendance',
          IndexName: 'userId-date-index', // GSI on userId + date
          KeyConditionExpression: 'userId = :uid AND #date = :today',
          ExpressionAttributeValues: {
            ':uid': body.userId,
            ':today': today,
          },
          ExpressionAttributeNames: { '#date': 'date' },
        }),
      );

      if (existingResult.Count && existingResult.Count > 0) {
        await this.dynamo.getClient().send(
          new UpdateCommand({
            TableName: 'Attendance',
            Key: { id: existingResult.Items?.[0].id },
            UpdateExpression: 'SET checkOut = :co',
            ExpressionAttributeValues: { ':co': null },
          }),
        );
        return { ...existingResult.Items?.[0], checkOut: null };
      }

      const officeTimingResult = await dynamoClient.send(
        new ScanCommand({
          TableName: 'OfficeTiming',
          FilterExpression: 'isActive = :true',
          ExpressionAttributeValues: { ':true': true },
        }),
      );

      if (!officeTimingResult.Items || officeTimingResult.Items.length === 0)
        throw new NotFoundException('Active office timing not found');

      const officeTiming = officeTimingResult.Items[0];

      const endTimeStr = officeTiming.endTime; // '1970-01-01T14:15:00.000Z'
      const checkIn = new Date(checkInTime);

      // Extract time from endTime
      const endTime = new Date(endTimeStr);

      // Create a new date using check-in date + endTime hours/minutes
      const endDateTime = new Date(checkIn);
      endDateTime.setUTCHours(
        endTime.getUTCHours(),
        endTime.getUTCMinutes(),
        endTime.getUTCSeconds(),
        0,
      );

      // Calculate difference in milliseconds
      const diffMs = endDateTime.getTime() - checkIn.getTime();

      // Convert to hours (decimal)
      const workingHours = diffMs / (1000 * 60 * 60);

      attendanceId = uuidv4();
      const attendance = {
        id: attendanceId,
        userId: body.userId,
        date: today,
        checkIn: checkInTime.toISOString(),
        officeTimingId: officeTiming.id,
        status: 'PRESENT',
        expiresAt: this.getTTLInSeconds(2).toString(),
        workingHours: workingHours,
        lateHours: 0,
        earlyLeave: 0,
        overtimeHours: 0,
        createdAt: new Date().toISOString(),
        checkOut: null,
        note : null,
      };

      await dynamoClient.send(
        new PutCommand({
          TableName: 'Attendance',
          Item: attendance,
          ConditionExpression: 'attribute_not_exists(id)', // prevent duplicates
        }),
      );

      return attendance;
    } catch (error) {
      console.error('❌ Error during check-in:', error);

      // --------------------------
      // 4️⃣ ROLLBACK if anything fails
      // --------------------------
      if (attendanceId) {
        try {
          await dynamoClient.send(
            new DeleteCommand({
              TableName: 'Attendance',
              Key: { id: attendanceId },
            }),
          );
        } catch (rollbackError) {
          console.error('❌ Rollback failed:', rollbackError);
        }
      }

      throw error; // rethrow original error
    }
  }

  // --------------------------
  // ✅ Check Out
  // --------------------------
  async checkOut(body: { userId: string; checkOutTime?: Date }) {
    const dynamoClient = this.dynamo.getClient();
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const checkOutTime = body.checkOutTime
      ? new Date(body.checkOutTime)
      : new Date();

    let attendanceId: string | undefined;

    try {
      // 1️⃣ Fetch today's attendance
      const attendanceResult = await dynamoClient.send(
        new QueryCommand({
          TableName: 'Attendance',
          IndexName: 'userId-date-index',
          KeyConditionExpression: 'userId = :uid AND #date = :today',
          ExpressionAttributeValues: {
            ':uid': body.userId,
            ':today': today,
          },
          ExpressionAttributeNames: { '#date': 'date' },
        }),
      );

      if (!attendanceResult.Items || attendanceResult.Items.length === 0)
        throw new NotFoundException('No check-in found for today');

      const attendance = attendanceResult.Items[0];
      const attendanceId = attendance.id;

      const checkIn = new Date(attendance.checkIn);
      const checkOut = checkOutTime;

      // 2️⃣ Fetch office timing
      const officeTimingResult = await dynamoClient.send(
        new GetCommand({
          TableName: 'OfficeTiming',
          Key: { id: attendance.officeTimingId },
        }),
      );

      if (!officeTimingResult.Item)
        throw new NotFoundException('Office timing not found');

      const officeTiming = officeTimingResult.Item;

      const startTimeRaw = new Date(officeTiming.startTime);
      const endTimeRaw = new Date(officeTiming.endTime);

      const officeHours = officeTiming.workingHours;
      const graceMinutes = officeTiming.graceMinutes || 0;

      // 🔥 IMPORTANT: Convert office timing to TODAY
      const officeStart = new Date(checkIn);
      officeStart.setUTCHours(
        startTimeRaw.getUTCHours(),
        startTimeRaw.getUTCMinutes(),
        0,
        0,
      );

      const officeEnd = new Date(checkIn);
      officeEnd.setUTCHours(
        endTimeRaw.getUTCHours(),
        endTimeRaw.getUTCMinutes(),
        0,
        0,
      );

      // 3️⃣ Calculations

      // ✅ Working Hours
      const actualWorkedHours =
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);

      let lateHours = 0;

      // ✅ Late Hours
      if (checkIn.getTime() > startTimeRaw.getTime()) {
        lateHours = (checkIn.getTime() - officeStart.getTime()) / 3600000;
      }

      // Apply grace
      if (lateHours > 0 && lateHours * 60 <= graceMinutes) {
        lateHours = 0;
      } else {
        lateHours = Math.max(0, lateHours);
      }

      // ✅ Early Leave
      const earlyLeave = Math.max(
        0,
        (officeEnd.getTime() - checkOut.getTime()) / (1000 * 60 * 60),
      );

      // ✅ Overtime
      const overtimeHours = Math.max(0, actualWorkedHours - officeHours);

      // Optional: round values (clean output)
      const round = (val: number) => Math.round(val * 100) / 100;

      let status: 'PRESENT' | 'HALF_DAY' | 'ABSENT';

      const ratio = actualWorkedHours / officeHours;

      if (ratio < 0.25) {
        status = 'ABSENT';
      } else if (ratio < 0.8) {
        status = 'HALF_DAY';
      } else {
        status = 'PRESENT';
      }

      // 4️⃣ Update DynamoDB
      await dynamoClient.send(
        new UpdateCommand({
          TableName: 'Attendance',
          Key: { id: attendanceId },
          UpdateExpression: `
            SET checkOut = :co,
                workingHours = :wh,
                lateHours = :lh,
                earlyLeave = :el,
                overtimeHours = :ot,
                #status = :st,
                updatedAt = :ua
          `,
          ExpressionAttributeNames: {
            '#status': 'status', // 🔥 required
          },
          ExpressionAttributeValues: {
            ':co': checkOut.toISOString(),
            ':wh': round(actualWorkedHours),
            ':lh': round(lateHours),
            ':el': round(earlyLeave),
            ':ot': round(overtimeHours),
            ':st': status,
            ':ua': new Date().toISOString(),
          },
        }),
      );

      // await this.payrollService.updateMonthlyPayroll(attendance.userId, attendance.date);

      return {
        ...attendance,
        checkOut,
        workingHours: round(actualWorkedHours),
        lateHours: round(lateHours),
        earlyLeave: round(earlyLeave),
        overtimeHours: round(overtimeHours),
      };
    } catch (error) {
      console.error('❌ CheckOut failed:', error);

      // 🔄 Rollback DynamoDB
      if (attendanceId) {
        try {
          await dynamoClient.send(
            new UpdateCommand({
              TableName: 'Attendance',
              Key: { id: attendanceId },
              UpdateExpression:
                'REMOVE checkOut, workingHours, lateHours, earlyLeave, overtimeHours',
            }),
          );
        } catch (rollbackError) {
          console.error('❌ DynamoDB rollback failed:', rollbackError);
        }
      }

      throw error;
    }
  }

  async getTodaysAttendance(userId: string) {
    const client = this.dynamo.getClient();

    // ✅ Get today's date in IST (simple)
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const existingResult = await client.send(
      new ScanCommand({
        TableName: 'Attendance',
        IndexName: 'userId-date-index', // GSI on userId + date
        FilterExpression: 'userId = :uid AND #date = :today',
        ExpressionAttributeValues: {
          ':uid': userId,
          ':today': today,
        },
        ExpressionAttributeNames: { '#date': 'date' },
      }),
    );

    return existingResult.Items?.[0] || [];
  }

  async getMonthlyAttendance(userId: string, month: number, year: number) {
    const client = this.dynamo.getClient();

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

    const res = await client.send(
      new QueryCommand({
        TableName: 'Attendance',
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
}
