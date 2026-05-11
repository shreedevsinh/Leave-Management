import { Injectable } from '@nestjs/common';
import { DynamoService } from '../../dynamo/dynamo.service';
import {
  PutCommand,
  ScanCommand,
  QueryCommand,
  BatchGetCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PayrollService {
  constructor(private dynamo: DynamoService) { }

  private getTTLInSeconds(years = 2) {
    const now = Math.floor(Date.now() / 1000);
    const secondsInYear = 365 * 24 * 60 * 60;

    return now + years * secondsInYear;
  }

  async getMonthlyPayroll(
    month: number,
    year: number,
    limit = 10,
    cursor: string | null,
  ) {
    const client = this.dynamo.getClient();

    let items: any[] = [];
    let lastKey: any = cursor
      ? JSON.parse(Buffer.from(cursor, 'base64').toString())
      : undefined;

    let nextCursor: string | null = null;

    // 🔁 LOOP until we collect enough filtered items
    do {
      const params: any = {
        TableName: 'Payrolls',
        FilterExpression: '#y = :year AND #m = :month',
        ExpressionAttributeNames: {
          '#m': 'month',
          '#y': 'year',
        },
        ExpressionAttributeValues: {
          ':month': month,
          ':year': year,
        },
        ExclusiveStartKey: lastKey,
      };

      const res = await client.send(new ScanCommand(params));

      const scannedItems = res.Items || [];

      items = [...items, ...scannedItems];

      lastKey = res.LastEvaluatedKey;
    } while (items.length < limit && lastKey);

    // ✂️ Trim to exact limit
    const payrolls = items.slice(0, limit);

    if (!payrolls.length) {
      return {
        items: [],
        totalSalary: 0,
        nextCursor: null,
      };
    }

    // =========================
    // 👤 Fetch Users
    // =========================
    const userIds = [...new Set(payrolls.map((p) => p.userId).filter(Boolean))];

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
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const result = payrolls.map((p) => ({
      ...p,
      user: userMap[p.userId] || null,
    }));

    // =========================
    // 💰 Total Salary (current page)
    // =========================
    const totalSalary = payrolls.reduce((sum, p) => {
      return sum + (Number(p.salary) || 0);
    }, 0);

    // =========================
    // 📌 Next Cursor
    // =========================
    nextCursor = lastKey
      ? Buffer.from(JSON.stringify(lastKey)).toString('base64')
      : null;

    return {
      items: result,
      totalSalary,
      nextCursor,
    };
  }

  /* =========================================================
      MAIN FUNCTION
  ========================================================= */
  async generateMonthlyPayroll(month: number, year: number) {
    month = Number(month);
    year = Number(year);

    const client = this.dynamo.getClient();
    const totalDays = new Date(year, month, 0).getDate();
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
          totalDays,
          createdAt: new Date().toISOString(),
          expiresAt: this.getTTLInSeconds(2).toString(),
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

  private async calculateWorkingDays(month: number, year: number) {
    const dynamoClient = this.dynamo.getClient();

    // 1. Fetch holidays for the year
    const res = await dynamoClient.send(
      new QueryCommand({
        TableName: 'Holiday',
        IndexName: 'year-index',
        KeyConditionExpression: '#year = :year',
        ExpressionAttributeNames: {
          '#year': 'year',
        },
        ExpressionAttributeValues: {
          ':year': Number(year),
        },
      }),
    );

    const holidays = res.Items || [];

    // 2. Get holidays only for selected month
    const monthHolidays = holidays.filter((h: any) => {
      const d = new Date(h.date);
      return d.getMonth() + 1 === month;
    });

    // 3. Count working days (Mon–Fri)
    const totalDays = new Date(year, month, 0).getDate();

    let workingDays = 0;

    for (let d = 1; d <= totalDays; d++) {
      const currentDate = new Date(year, month - 1, d);
      const day = currentDate.getDay();

      const isWeekend = day === 0 || day === 6;

      // check if holiday exists on this date
      const isHoliday = monthHolidays.some((h: any) => {
        const hd = new Date(h.date);
        return hd.getDate() === d;
      });

      // Rule:
      // - count Mon–Fri
      // - subtract holiday only if NOT weekend
      if (!isWeekend) {
        if (!isHoliday) {
          workingDays++;
        }
      }
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

  async getEmployeeMonthlyDetails(userId: string, month: number, year: number) {
    try {
      const client = this.dynamo.getClient();

      // ✅ Clean userId (if needed)
      const cleanUserId = userId.split('-').slice(0, 5).join('-');

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const start = startDate.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];

      // ✅ CORRECT QUERY (NO { S: })
      const res = await client.send(
        new QueryCommand({
          TableName: 'Attendance',
          IndexName: 'userId-date-index',

          KeyConditionExpression: 'userId = :u AND #dt BETWEEN :start AND :end',

          ExpressionAttributeNames: {
            '#dt': 'date',
            '#st': 'status',
          },

          ExpressionAttributeValues: {
            ':u': cleanUserId,
            ':start': start,
            ':end': end,
          },

          ProjectionExpression:
            'userId, #dt, checkIn, checkOut, workingHours, #st',
        }),
      );

      // ✅ DocumentClient already unmarshalls → REMOVE unmarshall()
      const records = res.Items || [];

      // ✅ Map for fast lookup
      const recordMap = new Map<string, any>();
      for (const r of records) {
        if (r.date) recordMap.set(r.date, r);
      }

      let presentDays = 0;
      let halfDays = 0;
      let missingCheckout = 0;
      let leaves = 0;

      const days: any[] = [];
      const totalDays = endDate.getDate();

      for (let i = 1; i <= totalDays; i++) {
        const currentDate = new Date(year, month - 1, i);
        const dateStr = currentDate.toISOString().split('T')[0];

        const record = recordMap.get(dateStr);

        let status = 'leave';
        let checkIn: string | null = null;
        let checkOut: string | null = null;
        let hours: string | null = null;

        if (record) {
          checkIn = record.checkIn ?? null;
          checkOut = record.checkOut ?? null;

          if (
            record.workingHours !== undefined &&
            record.workingHours !== null
          ) {
            const hrs = Number(record.workingHours);
            if (!isNaN(hrs)) {
              hours = `${hrs.toFixed(1)}h`;
            }
          }

          switch (record.status) {
            case 'PRESENT':
              if (checkIn && !checkOut) {
                missingCheckout++;
                status = 'missing_checkout';
              } else if (checkIn && checkOut) {
                presentDays++;
                status = 'present';
              }
              break;

            case 'HALF_DAY':
              halfDays++;
              status = 'half';
              break;

            case 'ABSENT':
              leaves++;
              status = 'leave';
              break;

            default:
              leaves++;
          }
        } else {
          leaves++;
        }

        days.push({
          date: dateStr,
          day: currentDate.toLocaleDateString('en-US', {
            weekday: 'short',
          }),
          checkIn,
          checkOut,
          hours,
          status,
          userId,
        });
      }

      return {
        presentDays,
        halfDays,
        missingCheckout,
        leaves,
        totalDays,
        days,
      };
    } catch (error) {
      console.error('❌ Payroll Details Error:', error);

      return {
        presentDays: 0,
        halfDays: 0,
        missingCheckout: 0,
        leaves: 0,
        totalDays: 0,
        days: [],
      };
    }
  }

  async markAttendance(data: any) {
    try {
      const client = this.dynamo.getClient();

      const { userId, date, checkIn, checkOut, status } = data;

      if (status === "leave" || status === "absent") {
        console.log("Deleting attendance for leave/absent day");

        const result = await client.send(
          new QueryCommand({
            TableName: "Attendance",
            IndexName: "userId-date-index",
            KeyConditionExpression: "userId = :userId AND #date = :date",
            ExpressionAttributeNames: {
              "#date": "date",
            },
            ExpressionAttributeValues: {
              ":userId": userId,
              ":date": date,
            },
          })
        );

        if (result.Items?.length) {
          await client.send(
            new DeleteCommand({
              TableName: "Attendance",
              Key: {
                id: result.Items[0].id,
              },
            })
          );
        }

        return;
      }

      const parseDateTime = (
        date: string,
        time?: string
      ) => {
        if (!time) return null;

        const [timePart, modifier] = time.trim().split(" ");

        let [hours, minutes] = timePart.split(":").map(Number);

        if (modifier === "PM" && hours < 12) hours += 12;
        if (modifier === "AM" && hours === 12) hours = 0;

        const [year, month, day] = date.split("-").map(Number);

        // Create IST timestamp manually
        const istMillis =
          Date.UTC(year, month - 1, day, hours, minutes) -
          5.5 * 60 * 60 * 1000;

        return new Date(istMillis);
      };

      const convertToUTC = ( date: string, time?: string ) =>
        time
          ? parseDateTime( date, time )?.toISOString()
          : null;

      const round = (val: number) =>
        Math.round(val * 100) / 100;

      // Get active office timing
      const officeTimingResult =
        await client.send(
          new ScanCommand({
            TableName: "OfficeTiming",
            FilterExpression:
              "isActive = :active",
            ExpressionAttributeValues:
            {
              ":active": true,
            },
          })
        );

      const officeTiming = officeTimingResult.Items?.[0];

      if (!officeTiming) {
        throw new Error(
          "No active office timing found"
        );
      }

      const checkInDate = parseDateTime(date, checkIn);
      console.log("date ==> ", date);
      console.log("checkIn ==> ", checkIn);
      console.log("checkInDate ==> ", checkInDate);

      const checkOutDate = parseDateTime(date, checkOut);

      if ( !checkInDate || !checkOutDate ) {
        throw new Error(
          "Check-in and check-out required"
        );
      }

      const startTimeRaw = new Date( officeTiming.startTime );
      console.log("startTimeRaw ==> ", startTimeRaw);

      const endTimeRaw = new Date( officeTiming.endTime );

      const officeStart = new Date(checkInDate);
      console.log("checkInDate ==> ", checkInDate);
      console.log("officeStart ==> ", officeStart);

      officeStart.setHours( startTimeRaw.getUTCHours(), startTimeRaw.getUTCMinutes(), 0, 0 );

      const officeEnd = new Date(checkInDate);

      officeEnd.setHours( endTimeRaw.getUTCHours(), endTimeRaw.getUTCMinutes(), 0, 0 );

      const officeHours = officeTiming.workingHours;

      const graceMinutes = officeTiming.graceMinutes || 0;

      const actualWorkedHours = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60);

      let lateHours = 0;

      if ( checkInDate.getTime() > officeStart.getTime() ) {
        lateHours = (checkInDate.getTime() - officeStart.getTime()) / 3600000;
      }

      if ( lateHours > 0 && lateHours * 60 <= graceMinutes ) {
        lateHours = 0;
      }

      const earlyLeave = Math.max( 0, (officeEnd.getTime() - checkOutDate.getTime()) / (1000 * 60 * 60) );

      const overtimeHours = Math.max( 0, actualWorkedHours - officeHours );

      const ratio = actualWorkedHours / officeHours;

      let updatedStatus: | "PRESENT" | "HALF_DAY" | "ABSENT";

      if (ratio < 0.25) {
        updatedStatus = "ABSENT";
      } else if (ratio < 0.8) {
        updatedStatus = "HALF_DAY";
      } else {
        updatedStatus = "PRESENT";
      }

      const checkInTime = checkInDate.toTimeString();
      console.log("checkInTime ==> ", checkInTime);
      const newcheckInTime = convertToUTC( date, checkIn );
      console.log("newcheckInTime ==> ", newcheckInTime);

      const checkOutTime = checkOutDate.toTimeString();
      console.log("checkOutTime ==> ", checkOutTime);
      const newcheckOutTime = convertToUTC( date, checkOut );
      console.log("newcheckOutTime ==> ", newcheckOutTime);

      // Check existing attendance
      const existingAttendanceResult =
        await client.send(
          new ScanCommand({
            TableName:
              "Attendance",
            FilterExpression:
              "userId = :userId AND #date = :date",
            ExpressionAttributeNames:
            {
              "#date": "date",
            },
            ExpressionAttributeValues:
            {
              ":userId": userId,
              ":date": date,
            },
          })
        );

      const existingAttendance =
        existingAttendanceResult
          .Items?.[0];

      const attendancePayload =
      {
        checkIn: newcheckInTime,
        checkOut: newcheckOutTime,
        updatedAt: new Date().toISOString(),
        officeTimingId: officeTiming.id,
        workingHours: round( actualWorkedHours ),
        lateHours: round( lateHours ),
        earlyLeave: round( earlyLeave ),
        overtimeHours: round( overtimeHours ),
        note: "",
        status: updatedStatus,
      };

      // UPDATE
      if (existingAttendance) {
        await client.send(
          new UpdateCommand({
            TableName:
              "Attendance",
            Key: {
              id:
                existingAttendance.id,
            },
            UpdateExpression: `
              SET checkIn = :checkIn,
                  checkOut = :checkOut,
                  updatedAt = :updatedAt,
                  officeTimingId = :officeTimingId,
                  workingHours = :workingHours,
                  lateHours = :lateHours,
                  earlyLeave = :earlyLeave,
                  overtimeHours = :overtimeHours,
                  note = :note,
                  #status = :status
            `,
            ExpressionAttributeNames:
            {
              "#status": "status",
            },
            ExpressionAttributeValues:
            {
              ":checkIn":
                attendancePayload.checkIn,
              ":checkOut":
                attendancePayload.checkOut,
              ":updatedAt":
                attendancePayload.updatedAt,
              ":officeTimingId":
                attendancePayload.officeTimingId,
              ":workingHours":
                attendancePayload.workingHours,
              ":lateHours":
                attendancePayload.lateHours,
              ":earlyLeave":
                attendancePayload.earlyLeave,
              ":overtimeHours":
                attendancePayload.overtimeHours,
              ":note":
                attendancePayload.note,
              ":status":
                attendancePayload.status,
            },
          })
        );

        return {
          ...existingAttendance,
          ...attendancePayload,
        };
      }

      // CREATE NEW
      const attendanceData = {
        id: uuidv4(),
        userId,
        date,
        createdAt:
          new Date().toISOString(),
        ...attendancePayload,
      };

      await client.send(
        new PutCommand({
          TableName:
            "Attendance",
          Item:
            attendanceData,
        })
      );

      return attendanceData;

    } catch (error) {
      throw error;
    }
  }
}
