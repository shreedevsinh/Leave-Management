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
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private dynamo: DynamoService,
  ) {}

  async checkIn() {
    console.log('chack In ......................... ');
  }
  async checkOut() {
    console.log('chack Out ......................... ');
  }
}
