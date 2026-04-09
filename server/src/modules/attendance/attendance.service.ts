import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DynamoService } from 'src/dynamo/dynamo.service';
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
    private prisma: PrismaService,
    private dynamo: DynamoService,
    private payrollService: PayrollService,
  ) {}

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

    console.log('📅 Original today date:', today);

    const checkInTime = body.checkInTime
      ? new Date(body.checkInTime)
      : new Date();
    let attendanceId: string | null = null;

    console.log('🟢 CheckIn started for user:', body.userId);
    console.log('📅 Today:', today);

    // Validate
    if (isNaN(checkInTime.getTime())) {
      throw new BadRequestException('Invalid check-in time');
    }

    console.log('⏰ CheckIn time:', checkInTime.toISOString());

    try {
      // --------------------------
      // 1️⃣ Check if already checked in
      // --------------------------
      console.log('🔍 Checking existing attendance...');
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

      console.log('🔹 Existing attendance count:', existingResult.Count);

      if (existingResult.Count && existingResult.Count > 0) {
        await this.dynamo.getClient().send(
          new UpdateCommand({
            TableName: 'Attendance',
            Key: { id: existingResult.Items?.[0].id },
            UpdateExpression: 'SET checkOut = :co',
            ExpressionAttributeValues: { ':co': null },
          }),
        );
        console.log('🔄 Existing attendance updated with new check-out time');
        return { ...existingResult.Items?.[0], checkOut: null };
      }

      // --------------------------
      // 2️⃣ Get active office timing from DynamoDB
      // --------------------------
      console.log('🔍 Fetching active office timing...');
      const officeTimingResult = await dynamoClient.send(
        new ScanCommand({
          TableName: 'OfficeTiming',
          FilterExpression: 'isActive = :true',
          ExpressionAttributeValues: { ':true': true },
        }),
      );

      if (!officeTimingResult.Items || officeTimingResult.Items.length === 0)
        throw new NotFoundException('Active office timing not found');

      console.log(
        '🔹 Office timing items found:',
        officeTimingResult.Items?.length,
      );

      if (!officeTimingResult.Items || officeTimingResult.Items.length === 0)
        throw new NotFoundException('Active office timing not found');

      const officeTiming = officeTimingResult.Items[0];
      console.log('🕑 Using office timing ID:', officeTiming.id);

      // --------------------------
      // 3️⃣ Create attendance
      // --------------------------
      attendanceId = uuidv4();
      const attendance = {
        id: attendanceId,
        userId: body.userId,
        date: today,
        checkIn: checkInTime.toISOString(),
        officeTimingId: officeTiming.id,
        status: 'PRESENT',
      };

      console.log('💾 Creating attendance record with ID:', attendanceId);
      await dynamoClient.send(
        new PutCommand({
          TableName: 'Attendance',
          Item: attendance,
          ConditionExpression: 'attribute_not_exists(id)', // prevent duplicates
        }),
      );

      console.log('✅ Attendance successfully created');
      return attendance;
    } catch (error) {
      console.error('❌ Error during check-in:', error);

      // --------------------------
      // 4️⃣ ROLLBACK if anything fails
      // --------------------------
      if (attendanceId) {
        console.log('🔄 Rolling back attendance with ID:', attendanceId);
        try {
          await dynamoClient.send(
            new DeleteCommand({
              TableName: 'Attendance',
              Key: { id: attendanceId },
            }),
          );
          console.log('✅ Rollback successful');
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
    console.log('⏰ CheckOut time:', checkOutTime.toISOString());

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

      console.log('⏳ Check-in time:', checkIn.getTime());
      console.log('⏳ Office start time:', officeStart.getTime());

      // ✅ Late Hours
      if (checkIn.getTime() > startTimeRaw.getTime()) {
        lateHours = (checkIn.getTime() - officeStart.getTime()) / 3600000;
      }

      console.log('⏳ Calculated late hours before grace:', lateHours);

      // Apply grace
      if (lateHours > 0 && lateHours * 60 <= graceMinutes) {
        lateHours = 0;
      } else {
        lateHours = Math.max(0, lateHours);
      }

      console.log('⏳ Check-out time:', checkOut.getTime());
      console.log('⏳ Office end time:', officeEnd.getTime());

      // ✅ Early Leave
      const earlyLeave = Math.max(
        0,
        (officeEnd.getTime() - checkOut.getTime()) / (1000 * 60 * 60),
      );

      console.log('⏳ Calculated early leave hours:', earlyLeave);

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

      console.log('📊 Attendance calculations:', {
        actualWorkedHours: round(actualWorkedHours),
        lateHours: round(lateHours),
        earlyLeave: round(earlyLeave),
        overtimeHours: round(overtimeHours),
        status,
      });

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
                #status = :st
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
          },
        }),
      );

      // 5️⃣ Update Prisma
      const prismaRecord = await this.prisma.attendance.findUnique({
        where: { id: attendanceId },
      });

      if (prismaRecord) {
        await this.prisma.attendance.update({
          where: { id: attendanceId },
          data: {
            checkOut,
            workingHours: round(actualWorkedHours),
            lateHours: round(lateHours),
            earlyLeave: round(earlyLeave),
            overtimeHours: round(overtimeHours),
          },
        });
      }

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
          console.log('♻️ DynamoDB rollback done');
        } catch (rollbackError) {
          console.error('❌ DynamoDB rollback failed:', rollbackError);
        }

        // Rollback Prisma
        try {
          const prismaRecord = await this.prisma.attendance.findUnique({
            where: { id: attendanceId },
          });
          if (prismaRecord) {
            await this.prisma.attendance.update({
              where: { id: attendanceId },
              data: {
                checkOut: null,
                workingHours: 0,
                lateHours: 0,
                earlyLeave: 0,
                overtimeHours: 0,
              },
            });
            console.log('♻️ Prisma rollback done');
          }
        } catch (rollbackError) {
          console.error('❌ Prisma rollback failed:', rollbackError);
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
