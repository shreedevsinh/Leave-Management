import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DynamoService } from 'src/dynamo/dynamo.service';
import {
  PutCommand,
  DeleteCommand,
  GetCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private dynamo: DynamoService,
  ) {}

  async createUser(data: CreateUserDto) {
    let dynamoUserId: string | null = null;
    const createdLeaveBalanceIds: string[] = [];

    try {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: data.email }, { mobile: data.mobile }],
        },
      });

      if (existingUser) {
        throw new ConflictException('Email or mobile already exists');
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const { v4: uuidv4 } = await import('uuid');
      const userId = uuidv4();
      dynamoUserId = userId;

      const now = new Date().toISOString();

      await this.dynamo.getClient().send(
        new PutCommand({
          TableName: 'Users',
          Item: {
            id: userId,
            name: data.name,
            email: data.email,
            mobile: data.mobile,
            password: hashedPassword,
            role: data.role,
            isActive: data.isActive ?? true,
            joinDate: data.joinDate.toString(),
            createdAt: now,
            updatedAt: now,
          },
        }),
      );

      const leaveTypesRes = await this.dynamo
        .getClient()
        .send(new ScanCommand({ TableName: 'LeaveTypes' }));

      const leaveBalancesDynamo = (leaveTypesRes.Items || []).map((type) => {
        const balanceId = uuidv4();
        createdLeaveBalanceIds.push(balanceId);

        return {
          id: balanceId,
          userId,
          typeId: type.id.toString(),
          total: type.maxPerYear,
          used: 0,
          remaining: type.maxPerYear,
          year: new Date().getFullYear(),
        };
      });

      await Promise.all(
        leaveBalancesDynamo.map((item) =>
          this.dynamo.getClient().send(
            new PutCommand({
              TableName: 'LeaveBalances',
              Item: item,
            }),
          ),
        ),
      );

      const user = await this.prisma.user.create({
        data: {
          id: userId,
          name: data.name,
          email: data.email,
          mobile: data.mobile,
          password: hashedPassword,
          role: data.role,
          isActive: data.isActive ?? true,
          joinDate: data.joinDate.toString(),
        },
      });

      await Promise.all(
        leaveBalancesDynamo.map((balance) =>
          this.prisma.leaveBalance.create({
            data: {
              id: balance.id,
              userId: balance.userId,
              typeId: String(balance.typeId),
              total: balance.total,
              used: balance.used,
              remaining: balance.remaining,
              year: balance.year,
            },
          }),
        ),
      );

      const { password, ...safeUser } = user;
      return { user: safeUser };
    } catch (error) {
      try {
        if (dynamoUserId) {
          await this.dynamo.getClient().send(
            new DeleteCommand({
              TableName: 'Users',
              Key: { id: dynamoUserId },
            }),
          );
        }

        if (createdLeaveBalanceIds.length) {
          await Promise.all(
            createdLeaveBalanceIds.map((id) =>
              this.dynamo.getClient().send(
                new DeleteCommand({
                  TableName: 'LeaveBalances',
                  Key: { id },
                }),
              ),
            ),
          );
        }
      } catch {}

      if (error instanceof ConflictException) throw error;
      throw new NotFoundException('Failed to create user');
    }
  }

  async updateUser(id: string, data: UpdateUserDto) {
    let oldDynamoUser: any = null;

    try {
      if (data.email || data.mobile) {
        const emailUser = data.email
          ? await this.findByEmail(data.email)
          : null;

        const mobileUser = data.mobile
          ? await this.findByMobile(data.mobile)
          : null;

        if (
          (emailUser && emailUser.id !== id) ||
          (mobileUser && mobileUser.id !== id)
        ) {
          throw new ConflictException('Email or mobile already exists');
        }
      }

      const existing = await this.dynamo.getClient().send(
        new GetCommand({
          TableName: 'Users',
          Key: { id },
        }),
      );

      if (!existing.Item) {
        throw new NotFoundException('User not found in DynamoDB');
      }

      oldDynamoUser = existing.Item;

      const hashedPassword = data.password
        ? await bcrypt.hash(data.password, 10)
        : existing.Item.password;

      const updatedItem = {
        ...existing.Item,
        name: data.name ?? existing.Item.name,
        email: data.email ?? existing.Item.email,
        mobile: data.mobile ?? existing.Item.mobile,
        password: hashedPassword,
        role: data.role ?? existing.Item.role,
        isActive: data.isActive ?? existing.Item.isActive,
        joinDate: data.joinDate
          ? data.joinDate.toString()
          : existing.Item.joinDate,
        updatedAt: new Date().toISOString(),
      };

      await this.dynamo.getClient().send(
        new PutCommand({
          TableName: 'Users',
          Item: updatedItem,
        }),
      );

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          name: updatedItem.name,
          email: updatedItem.email,
          mobile: updatedItem.mobile,
          password: updatedItem.password,
          role: updatedItem.role,
          isActive: updatedItem.isActive,
          joinDate: updatedItem.joinDate,
        },
      });

      const { password, ...safeUser } = updatedUser;
      return { user: safeUser };
    } catch (error) {
      if (oldDynamoUser) {
        try {
          await this.dynamo.getClient().send(
            new PutCommand({
              TableName: 'Users',
              Item: oldDynamoUser,
            }),
          );
        } catch {}
      }

      if (error instanceof ConflictException) throw error;
      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException('Failed to update user');
    }
  }

  async updateUserNameEmail(id: string, data: UpdateUserDto) {
    let oldDynamoUser: any = null;

    try {
      if (data.email || data.mobile) {
        const emailUser = data.email
          ? await this.findByEmail(data.email)
          : null;

        const mobileUser = data.mobile
          ? await this.findByMobile(data.mobile)
          : null;

        if (
          (emailUser && emailUser.id !== id) ||
          (mobileUser && mobileUser.id !== id)
        ) {
          throw new ConflictException('Email or mobile already exists');
        }
      }

      const existing = await this.dynamo.getClient().send(
        new GetCommand({
          TableName: 'Users',
          Key: { id },
        }),
      );

      if (!existing.Item) {
        throw new NotFoundException('User not found in DynamoDB');
      }

      oldDynamoUser = existing.Item;

      const hashedPassword = data.password
        ? await bcrypt.hash(data.password, 10)
        : existing.Item.password;

      const updatedItem = {
        ...existing.Item,
        name: data.name ?? existing.Item.name,
        email: data.email ?? existing.Item.email,
        mobile: data.mobile ?? existing.Item.mobile,
        password: hashedPassword,
        updatedAt: new Date().toISOString(),
      };

      await this.dynamo.getClient().send(
        new PutCommand({
          TableName: 'Users',
          Item: updatedItem,
        }),
      );

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          name: updatedItem.name,
          email: updatedItem.email,
          mobile: updatedItem.mobile,
          password: updatedItem.password,
        },
      });

      const { password, ...safeUser } = updatedUser;
      return { user: safeUser };
    } catch (error) {
      if (oldDynamoUser) {
        try {
          await this.dynamo.getClient().send(
            new PutCommand({
              TableName: 'Users',
              Item: oldDynamoUser,
            }),
          );
        } catch {}
      }

      if (error instanceof ConflictException) throw error;
      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException('Failed to update user');
    }
  }

  async findByEmail(email: string) {
    try {
      const result = await this.dynamo.getClient().send(
        new ScanCommand({
          TableName: 'Users',
          FilterExpression: 'email = :email',
          ExpressionAttributeValues: {
            ':email': email,
          },
        }),
      );

      return result.Items?.[0] || null;
    } catch {
      throw new InternalServerErrorException('Failed to find user');
    }
  }

  async findByMobile(mobile: string) {
    try {
      const result = await this.dynamo.getClient().send(
        new ScanCommand({
          TableName: 'Users',
          FilterExpression: 'mobile = :mobile',
          ExpressionAttributeValues: {
            ':mobile': mobile,
          },
        }),
      );

      return result.Items?.[0] || null;
    } catch {
      throw new InternalServerErrorException('Failed to find user');
    }
  }

  async getEmployees() {
    try {
      const result = await this.dynamo.getClient().send(
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

      return result.Items || [];
    } catch {
      throw new InternalServerErrorException('Failed to get employees');
    }
  }

  async getEmployee(id: string) {
    try {
      const userRes = await this.dynamo.getClient().send(
        new GetCommand({
          TableName: 'Users',
          Key: { id: String(id) },
        }),
      );

      const user = userRes.Item;
      if (!user) return null;

      const leavesRes = await this.dynamo.getClient().send(
        new ScanCommand({
          TableName: 'Leaves',
          FilterExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': id,
          },
        }),
      );

      return {
        ...user,
        leaves: leavesRes.Items || [],
      };
    } catch {
      throw new InternalServerErrorException('Failed to get employee');
    }
  }

  async deleteEmployee(id: string): Promise<boolean> {
    try {
      // await this.prisma.user.delete({ where: { id: String(id) } });

      await this.dynamo.getClient().send(
        new DeleteCommand({
          TableName: 'Users',
          Key: { id },
        }),
      );

      return true;
    } catch {
      throw new InternalServerErrorException('Failed to delete employee');
    }
  }
}
