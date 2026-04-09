import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DynamoService } from 'src/dynamo/dynamo.service';
import {
  PutCommand,
  DeleteCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import * as bcrypt from 'bcrypt';
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
      const existingUser =
        (await this.findByEmail(data.email)) ||
        (await this.findByMobile(data.mobile)) ||
        null;

      if (existingUser) {
        console.log('❌ Conflict: Email or mobile already exists');
        throw new ConflictException('Email or mobile already exists');
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);

      const { v4: uuidv4 } = await import('uuid');
      const userId = uuidv4();
      const salaryId = uuidv4();
      dynamoUserId = userId;
      const now = new Date().toISOString();

      const user = await this.dynamo.getClient().send(
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
            salary: data.salary,
            isHourly: false,
            createdAt: now,
            updatedAt: now,
          },
        }),
      );

      await this.dynamo.getClient().send(
        new PutCommand({
          TableName: 'Salaries',
          Item: {
            id: salaryId,
            userId,
            baseSalary: data.salary,
            createdAt: now,
            isActive: true,
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

      const parsedJoinDate = new Date(data.joinDate);

      if (isNaN(parsedJoinDate.getTime())) {
        console.error('❌ INVALID DATE INPUT:', data.joinDate);
        throw new BadRequestException('Invalid joinDate format');
      }

      return { user: user };
    } catch (error) {
      console.error('🔥 ERROR OCCURRED:', error);
      throw new NotFoundException('Failed to create user');
    }
  }

  async updateUser(id: string, data: UpdateUserDto) {
    let oldDynamoUser: any = null;
    let curruntSalaryId: any = null;

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

      const { password, ...safeUser } = existing.Item;
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

  async updateSalary(userId: string, newSalary: number) {
    try {
      if (!newSalary || newSalary <= 0) {
        throw new BadRequestException('Invalid salary amount');
      }

      const { v4: uuidv4 } = await import('uuid');
      const newSalaryId = uuidv4();

      const client = this.dynamo.getClient();

      // 🔍 Find current active salary (optional)
      const currentSalaryRes = await client.send(
        new ScanCommand({
          TableName: 'Salaries',
          FilterExpression: 'userId = :userId AND isActive = :isActive',
          ExpressionAttributeValues: {
            ':userId': userId,
            ':isActive': true,
          },
        }),
      );

      const currentSalary = currentSalaryRes.Items?.[0] || null;

      // 🔄 If exists → deactivate
      if (currentSalary) {
        await client.send(
          new UpdateCommand({
            TableName: 'Salaries',
            Key: { id: currentSalary.id },
            UpdateExpression: 'SET isActive = :false, endDate = :endDate',
            ExpressionAttributeValues: {
              ':false': false,
              ':endDate': new Date().toISOString(),
            },
          }),
        );
      }

      // ➕ Always create new salary
      const newItem = {
        id: newSalaryId,
        userId,
        baseSalary: newSalary,
        createdAt: new Date().toISOString(),
        isActive: true,
      };

      await client.send(
        new PutCommand({
          TableName: 'Salaries',
          Item: newItem,
        }),
      );

      await client.send(
        new UpdateCommand({
          TableName: 'Users',
          Key: { id: userId },
          UpdateExpression: 'SET salary = :salary',
          ExpressionAttributeValues: {
            ':salary': newSalary,
          },
        }),
      );

      // ✅ Clean response with history hint
      return {
        message: 'Salary updated successfully',
        data: newItem,
        previousSalary: currentSalary
          ? {
              id: currentSalary.id,
              baseSalary: currentSalary.baseSalary,
            }
          : null,
      };
    } catch (error) {
      console.error(error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to update salary');
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

      const { password, ...safeUser } = existing.Item;
      return { user: safeUser };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  async updateUserSalaryType(id: string, isHourly: boolean) {
    console.log(
      `Updating salary type for user ${id} to ${isHourly ? 'Hourly' : 'Daily'}`,
    );
    try {
      await this.dynamo.getClient().send(
        new UpdateCommand({
          TableName: 'Users',
          Key: { id },
          UpdateExpression: 'SET isHourly = :isHourly',
          ExpressionAttributeValues: {
            ':isHourly': isHourly,
          },
        }),
      );
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Failed to update salary type');
    }
    return true;
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
      const client = this.dynamo.getClient();

      // 👤 Get employees
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

      // 💰 Get active salaries
      const salaryRes = await client.send(
        new ScanCommand({
          TableName: 'Salaries',
          FilterExpression: 'isActive = :isActive',
          ExpressionAttributeValues: {
            ':isActive': true,
          },
        }),
      );

      // 🧠 Create salary map (userId → salary)
      const salaryMap = new Map<string, any>();

      (salaryRes.Items || []).forEach((s: any) => {
        salaryMap.set(s.userId, s);
      });

      // 🔗 Merge
      return (usersRes.Items || []).map((u: any) => {
        const salary = salaryMap.get(u.id);

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          mobile: u.mobile,
          role: u.role,
          isActive: u.isActive,
          isHourly: u.isHourly,
          salary: salary
            ? {
                id: salary.id,
                baseSalary: salary.baseSalary,
              }
            : null,
        };
      });
    } catch (error) {
      console.error(error);
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
