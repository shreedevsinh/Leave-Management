import { Injectable } from '@nestjs/common';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
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
import * as XLSX from 'xlsx';

@Injectable()
export class HolidayService {
  constructor(private dynamo: DynamoService) {}

  async create(createHolidayDto: CreateHolidayDto) {
    const { name, date, description, isOptional } = createHolidayDto;

    const dynamoClient = this.dynamo.getClient();

    const newHoliday = {
      id: uuidv4(),
      name,
      date,
      year: new Date(date).getFullYear(),
      description,
      isOptional,
      createdAt: new Date().toISOString(),

      // TTL MUST be Unix timestamp in seconds
      expiresAt: Math.floor(
        (Date.now() + 365 * 24 * 60 * 60 * 1000 * 2) / 1000,
      ),
    };

    const result = await dynamoClient.send(
      new PutCommand({
        TableName: 'Holiday',
        Item: newHoliday,
      }),
    );

    return {
      message: 'Holiday created successfully',
      data: newHoliday,
    };
  }

  async getHolidaysByMonth(month: string, year: string) {
    if (!month || !year) return [];

    const dynamoClient = this.dynamo.getClient();

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

    const holidays = (res.Items || []).filter((holiday: any) => {
      const holidayMonth = new Date(holiday.date).getMonth() + 1;

      return holidayMonth === Number(month);
    });

    return holidays;
  }

  async bulkUpload(file: any) {
    const dynamoClient = this.dynamo.getClient();

    // Read Excel Buffer
    const workbook = XLSX.read(file.buffer, {
      type: 'buffer',
    });

    const sheetName = workbook.SheetNames[0];

    const worksheet = workbook.Sheets[sheetName];

    // Convert Excel -> JSON
    const holidays = XLSX.utils.sheet_to_json(worksheet);

    const insertedHolidays = [];

    for (const holiday of holidays as any[]) {
      const holidayDate = new Date(holiday.date);

      const newHoliday = {
        id: uuidv4(),

        name: holiday.name,

        date: holidayDate.toISOString(),

        year: holidayDate.getFullYear(),

        description: holiday.description || '',

        isOptional:
          holiday.isOptional === true || holiday.isOptional === 'true',

        createdAt: new Date().toISOString(),

        expiresAt: Math.floor(
          (Date.now() + 365 * 24 * 60 * 60 * 1000 * 2) / 1000,
        ),
      };

      await dynamoClient.send(
        new PutCommand({
          TableName: 'Holiday',
          Item: newHoliday,
        }),
      );

      // insertedHolidays.push(newHoliday);
    }

    return {
      message: 'Bulk holidays created successfully',
      // count: insertedHolidays.length,
      data: insertedHolidays,
    };
  }

  async deleteHoliday(id: string) {
    const dynamoClient = this.dynamo.getClient();

    await dynamoClient.send(
      new DeleteCommand({
        TableName: 'Holiday',
        Key: { id },
      }),
    );

    return {
      message: 'Holiday deleted successfully',
    };
  }
}
