import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DynamoService } from 'src/dynamo/dynamo.service';
import { PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
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
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: data.email }, { mobile: data.mobile }],
        },
      });

      if (existingUser)
        throw new ConflictException('Email or mobile already exists');

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create user in MySQL
      const user = await this.prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          mobile: data.mobile,
          password: hashedPassword,
          role: data.role,
          isActive: data.isActive ?? true,
          joinDate: data.joinDate.toString(),
        },
      });

      // Store in DynamoDB
      await this.dynamo.getClient().send(
        new PutCommand({
          TableName: 'Users',
          Item: {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            password: user.password,
            role: user.role,
            isActive: user.isActive,
            joinDate: user.joinDate,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          },
        }),
      );

      // Fetch all leave types
      const leaveTypes = await this.prisma.leaveType.findMany();

      // Create leave balances for all leave types for this user
      const createdBalances = await Promise.all(
        leaveTypes.map((type) =>
          this.prisma.leaveBalance.create({
            data: {
              userId: user.id,
              typeId: type.id,
              total: type.maxPerYear,
              used: 0,
              remaining: type.maxPerYear,
              year: new Date().getFullYear(),
            },
          }),
        ),
      );

      await Promise.all(
        createdBalances.map((balance) =>
          this.dynamo.getClient().send(
            new PutCommand({
              TableName: 'LeaveBalances',
              Item: {
                id: balance.id.toString(),
                userId: balance.userId.toString(),
                typeId: balance.typeId.toString(),
                total: balance.total,
                used: balance.used,
                remaining: balance.remaining,
                year: balance.year,
              },
            }),
          ),
        ),
      );

      const { password, ...safeUser } = user;
      return { user: safeUser };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      console.error(error);
      throw new InternalServerErrorException('Failed to create user');
    }
  }
  async updateUser(id: number, data: UpdateUserDto) {
    try {
      if (data.email || data.mobile) {
        const orConditions: any[] = [
          data.email ? { email: data.email } : undefined,
          data.mobile ? { mobile: data.mobile } : undefined,
        ].filter(Boolean) as { email?: string; mobile?: string }[];

        const existingUser = await this.prisma.user.findFirst({
          where: {
            OR: orConditions.length > 0 ? orConditions : undefined,
            NOT: { id },
          },
        });

        if (existingUser)
          throw new ConflictException('Email or mobile already exists');
      }

      let hashedPassword;
      if (data.password) hashedPassword = await bcrypt.hash(data.password, 10);

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          name: data.name,
          email: data.email,
          mobile: data.mobile,
          password: hashedPassword,
          role: data.role,
          isActive: data.isActive,
          joinDate: data.joinDate,
        },
      });

      await this.dynamo.getClient().send(
        new PutCommand({
          TableName: 'Users',
          Item: {
            id: updatedUser.id.toString(),
            name: updatedUser.name,
            email: updatedUser.email,
            mobile: updatedUser.mobile,
            password: updatedUser.password,
            role: updatedUser.role,
            isActive: updatedUser.isActive,
            joinDate: updatedUser.joinDate.toString(),
            createdAt: updatedUser.createdAt.toISOString(),
            updatedAt: updatedUser.updatedAt.toISOString(),
          },
        }),
      );

      const { password, ...safeUser } = updatedUser;
      return { user: safeUser };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  async updateUserNameEmail(id: number, data: UpdateUserDto) {
    try {
      if (data.email || data.mobile) {
        const orConditions: any[] = [
          data.email ? { email: data.email } : undefined,
          data.mobile ? { mobile: data.mobile } : undefined,
        ].filter(Boolean) as { email?: string; mobile?: string }[];

        const existingUser = await this.prisma.user.findFirst({
          where: {
            OR: orConditions.length > 0 ? orConditions : undefined,
            NOT: { id },
          },
        });

        if (existingUser)
          throw new ConflictException('Email or mobile already exists');
      }

      let hashedPassword;
      if (data.password) hashedPassword = await bcrypt.hash(data.password, 10);

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          name: data.name,
          email: data.email,
          mobile: data.mobile,
          password: hashedPassword,
        },
      });

      await this.dynamo.getClient().send(
        new PutCommand({
          TableName: 'Users',
          Item: {
            id: updatedUser.id.toString(),
            name: updatedUser.name,
            email: updatedUser.email,
            mobile: updatedUser.mobile,
            password: updatedUser.password,
            updatedAt: updatedUser.updatedAt.toISOString(),
          },
        }),
      );

      const { password, ...safeUser } = updatedUser;
      return { user: safeUser };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  async findByEmail(email: string) {
    try {
      return this.prisma.user.findUnique({ where: { email } });
    } catch {
      throw new InternalServerErrorException('Failed to find user');
    }
  }

  async getEmployees() {
    try {
      return this.prisma.user.findMany({ where: { role: 'EMPLOYEE' } });
    } catch {
      throw new InternalServerErrorException('Failed to get employees');
    }
  }

  async getEmployee(id: string) {
    try {
      return this.prisma.user.findUnique({
        where: { id: Number(id) },
        include: { leaves: true },
      });
    } catch {
      throw new InternalServerErrorException('Failed to get employee');
    }
  }

  async deleteEmployee(id: string): Promise<boolean> {
    try {
      await this.prisma.user.delete({ where: { id: Number(id) } });

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
