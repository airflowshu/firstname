import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, UserStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

const REFRESH_TOKEN_BYTE_SIZE = 48;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async login(dto: LoginDto, response: Response) {
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

    const issuedSession = await this.issueSessionTokens({
      sub: user.id,
      username: user.username,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    const currentUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        refreshTokenHash: issuedSession.refreshTokenHash,
        refreshTokenExpiresAt: issuedSession.refreshTokenExpiresAt,
      },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    this.setRefreshTokenCookie(response, issuedSession.refreshToken);

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
      accessToken: issuedSession.accessToken,
      user: this.serializeUser(currentUser),
    };
  }

  async refresh(response: Response, refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new UnauthorizedException('登录状态已失效，请重新登录。');
    }

    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const currentUser = await this.prisma.user.findFirst({
      where: {
        refreshTokenHash,
        status: UserStatus.ACTIVE,
        refreshTokenExpiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!currentUser) {
      throw new UnauthorizedException('登录状态已失效，请重新登录。');
    }

    const issuedSession = await this.issueSessionTokens({
      sub: currentUser.id,
      username: currentUser.username,
      role: currentUser.role,
      tokenVersion: currentUser.tokenVersion,
    });

    const updatedUser = await this.prisma.user.update({
      where: { id: currentUser.id },
      data: {
        refreshTokenHash: issuedSession.refreshTokenHash,
        refreshTokenExpiresAt: issuedSession.refreshTokenExpiresAt,
      },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    this.setRefreshTokenCookie(response, issuedSession.refreshToken);

    return {
      accessToken: issuedSession.accessToken,
      user: this.serializeUser(updatedUser),
    };
  }

  async me(user: AuthenticatedUser) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
    });

    if (!currentUser || currentUser.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('登录状态已失效，请重新登录。');
    }

    return this.serializeUser(currentUser);
  }

  async logout(user: AuthenticatedUser | undefined, response: Response) {
    this.clearRefreshTokenCookie(response);

    if (user?.sub) {
      await this.prisma.user.updateMany({
        where: { id: user.sub },
        data: {
          tokenVersion: {
            increment: 1,
          },
          refreshTokenHash: null,
          refreshTokenExpiresAt: null,
        },
      });

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

  private async issueSessionTokens(payload: AuthenticatedUser) {
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTE_SIZE).toString('hex');
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const refreshTokenExpiresInSeconds = this.configService.get<number>(
      'refreshTokenExpiresInSeconds',
      604_800,
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenHash,
      refreshTokenExpiresAt: new Date(Date.now() + refreshTokenExpiresInSeconds * 1000),
    };
  }

  private hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private setRefreshTokenCookie(response: Response, token: string) {
    const refreshTokenExpiresInSeconds = this.configService.get<number>(
      'refreshTokenExpiresInSeconds',
      604_800,
    );
    const refreshTokenCookieName = this.configService.get<string>(
      'refreshTokenCookieName',
      'fisrtname_rt',
    );
    const isProduction = this.configService.get<string>('nodeEnv', 'development') === 'production';

    response.cookie(refreshTokenCookieName, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: refreshTokenExpiresInSeconds * 1000,
    });
  }

  private clearRefreshTokenCookie(response: Response) {
    const refreshTokenCookieName = this.configService.get<string>(
      'refreshTokenCookieName',
      'fisrtname_rt',
    );
    const isProduction = this.configService.get<string>('nodeEnv', 'development') === 'production';

    response.clearCookie(refreshTokenCookieName, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
  }
}
