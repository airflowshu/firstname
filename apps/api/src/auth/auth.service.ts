import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuditAction, UserStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('用户名或密码不正确。');
    }

    const passwordMatched = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatched) {
      throw new UnauthorizedException('用户名或密码不正确。');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: AuthenticatedUser = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    await this.auditLogsService.log({
      operatorId: user.id,
      action: AuditAction.LOGIN,
      targetType: 'AUTH',
      targetId: user.id,
      metadata: {
        username: user.username,
      },
    });

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: this.serializeUser(user),
    };
  }

  async me(user: AuthenticatedUser) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
    });

    if (!currentUser) {
      throw new UnauthorizedException('登录状态已失效，请重新登录。');
    }

    return this.serializeUser(currentUser);
  }

  async logout(user?: AuthenticatedUser) {
    if (user?.sub) {
      await this.auditLogsService.log({
        operatorId: user.sub,
        action: AuditAction.LOGOUT,
        targetType: 'AUTH',
        targetId: user.sub,
      });
    }

    return {
      success: true,
    };
  }

  private serializeUser(user: {
    id: string;
    username: string;
    role: string;
    status: string;
    lastLoginAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
