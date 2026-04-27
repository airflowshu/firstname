import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async list() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });

    return users.map((user) => this.serializeUser(user));
  }

  async create(dto: CreateUserDto, operatorId: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (existingUser) {
      throw new ConflictException('该用户名已存在，请更换后重试。');
    }

    const createdUser = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: dto.role,
        status: dto.status ?? UserStatus.ACTIVE,
      },
    });

    await this.auditLogsService.log({
      operatorId,
      action: dto.role === UserRole.ADMIN ? AuditAction.ROLE_CHANGE : AuditAction.CREATE,
      targetType: 'USER',
      targetId: createdUser.id,
      after: this.serializeUser(createdUser),
    });

    return this.serializeUser(createdUser);
  }

  async update(id: string, dto: UpdateUserDto, operatorId: string) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!currentUser) {
      throw new NotFoundException('未找到指定用户。');
    }

    if (dto.username && dto.username !== currentUser.username) {
      const usernameTaken = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });

      if (usernameTaken) {
        throw new ConflictException('该用户名已存在，请更换后重试。');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        username: dto.username,
        role: dto.role,
        status: dto.status,
        passwordHash: dto.password ? await bcrypt.hash(dto.password, 10) : undefined,
      },
    });

    await this.auditLogsService.log({
      operatorId,
      action:
        dto.role && dto.role !== currentUser.role ? AuditAction.ROLE_CHANGE : AuditAction.UPDATE,
      targetType: 'USER',
      targetId: id,
      before: this.serializeUser(currentUser),
      after: this.serializeUser(updatedUser),
    });

    return this.serializeUser(updatedUser);
  }

  private serializeUser(user: {
    id: string;
    username: string;
    role: UserRole;
    status: UserStatus;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt?: Date;
  }) {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
