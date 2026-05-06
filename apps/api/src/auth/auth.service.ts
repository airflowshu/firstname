import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  FamilyStatus,
  MembershipStatus,
  PlatformRole,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, LoginDto } from './dto/login.dto';

const REFRESH_TOKEN_BYTE_SIZE = 48;

type CurrentFamilyContext = {
  activeFamilyId: string | null;
  familyRole: UserRole | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async login(dto: LoginDto, response: Response) {
    const loginName = dto.username.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: loginName }, { phone: loginName }],
      },
      include: {
        memberships: {
          where: {
            status: MembershipStatus.ACTIVE,
            family: {
              status: FamilyStatus.ACTIVE,
            },
          },
          include: {
            family: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('用户名或手机号、密码不正确。');
    }

    const passwordMatched = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatched) {
      throw new UnauthorizedException('用户名或手机号、密码不正确。');
    }

    const familyContext = await this.resolveCurrentFamily(user, dto.familyId, {
      preferPlatformForSuper: true,
    });
    const issuedSession = await this.issueSessionTokens({
      sub: user.id,
      username: user.username,
      phone: user.phone,
      displayName: user.displayName,
      platformRole: user.platformRole,
      activeFamilyId: familyContext.activeFamilyId,
      familyRole: familyContext.familyRole,
      role: familyContext.familyRole ?? UserRole.ADMIN,
      tokenVersion: user.tokenVersion,
    });

    const currentUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastActiveFamilyId: familyContext.activeFamilyId,
        refreshTokenHash: issuedSession.refreshTokenHash,
        refreshTokenExpiresAt: issuedSession.refreshTokenExpiresAt,
      },
      include: this.userSessionInclude(),
    });
    this.setRefreshTokenCookie(response, issuedSession.refreshToken);

    await this.auditLogsService.log({
      operatorId: user.id,
      action: AuditAction.LOGIN,
      targetType: 'AUTH',
      targetId: user.id,
      metadata: {
        username: user.username,
        phone: user.phone,
        familyId: familyContext.activeFamilyId,
      },
    });

    return {
      accessToken: issuedSession.accessToken,
      user: this.serializeUser(currentUser, familyContext),
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
      include: this.userSessionInclude(),
    });

    if (!currentUser) {
      throw new UnauthorizedException('登录状态已失效，请重新登录。');
    }

    const familyContext = await this.resolveCurrentFamily(currentUser, undefined, {
      preferPlatformForSuper:
        currentUser.platformRole === PlatformRole.SUPER && !currentUser.lastActiveFamilyId,
    });
    const issuedSession = await this.issueSessionTokens({
      sub: currentUser.id,
      username: currentUser.username,
      phone: currentUser.phone,
      displayName: currentUser.displayName,
      platformRole: currentUser.platformRole,
      activeFamilyId: familyContext.activeFamilyId,
      familyRole: familyContext.familyRole,
      role: familyContext.familyRole ?? UserRole.ADMIN,
      tokenVersion: currentUser.tokenVersion,
    });

    const updatedUser = await this.prisma.user.update({
      where: { id: currentUser.id },
      data: {
        lastActiveFamilyId: familyContext.activeFamilyId,
        refreshTokenHash: issuedSession.refreshTokenHash,
        refreshTokenExpiresAt: issuedSession.refreshTokenExpiresAt,
      },
      include: this.userSessionInclude(),
    });

    this.setRefreshTokenCookie(response, issuedSession.refreshToken);

    return {
      accessToken: issuedSession.accessToken,
      user: this.serializeUser(updatedUser, familyContext),
    };
  }

  async switchFamily(familyId: string, user: AuthenticatedUser, response: Response) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      include: this.userSessionInclude(),
    });

    if (!currentUser || currentUser.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('登录状态已失效，请重新登录。');
    }

    if (currentUser.platformRole === PlatformRole.SUPER) {
      const family = await this.prisma.family.findFirst({
        where: { id: familyId, status: FamilyStatus.ACTIVE },
      });

      if (!family) {
        throw new ForbiddenException('目标家族不存在或已停用。');
      }

      await this.prisma.familyMembership.upsert({
        where: {
          userId_familyId: {
            userId: currentUser.id,
            familyId,
          },
        },
        create: {
          userId: currentUser.id,
          familyId,
          role: UserRole.ADMIN,
          status: MembershipStatus.ACTIVE,
        },
        update: {
          role: UserRole.ADMIN,
          status: MembershipStatus.ACTIVE,
        },
      });
    }

    const refreshedUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      include: this.userSessionInclude(),
    });

    if (!refreshedUser) {
      throw new UnauthorizedException('登录状态已失效，请重新登录。');
    }

    const familyContext = await this.resolveCurrentFamily(refreshedUser, familyId);
    const issuedSession = await this.issueSessionTokens({
      sub: refreshedUser.id,
      username: refreshedUser.username,
      phone: refreshedUser.phone,
      displayName: refreshedUser.displayName,
      platformRole: refreshedUser.platformRole,
      activeFamilyId: familyContext.activeFamilyId,
      familyRole: familyContext.familyRole,
      role: familyContext.familyRole ?? UserRole.ADMIN,
      tokenVersion: refreshedUser.tokenVersion,
    });

    const updatedUser = await this.prisma.user.update({
      where: { id: refreshedUser.id },
      data: {
        lastActiveFamilyId: familyContext.activeFamilyId,
        refreshTokenHash: issuedSession.refreshTokenHash,
        refreshTokenExpiresAt: issuedSession.refreshTokenExpiresAt,
      },
      include: this.userSessionInclude(),
    });

    this.setRefreshTokenCookie(response, issuedSession.refreshToken);

    return {
      accessToken: issuedSession.accessToken,
      user: this.serializeUser(updatedUser, familyContext),
    };
  }

  async me(user: AuthenticatedUser) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      include: this.userSessionInclude(),
    });

    if (!currentUser || currentUser.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('登录状态已失效，请重新登录。');
    }

    const familyContext = await this.resolveCurrentFamily(
      currentUser,
      user.activeFamilyId ?? undefined,
      {
        preferPlatformForSuper:
          currentUser.platformRole === PlatformRole.SUPER && !user.activeFamilyId,
      },
    );
    return this.serializeUser(currentUser, familyContext);
  }

  async changePassword(dto: ChangePasswordDto, user: AuthenticatedUser, response: Response) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        passwordHash: true,
        status: true,
      },
    });

    if (!currentUser || currentUser.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('登录状态已失效，请重新登录。');
    }

    const currentPasswordMatched = await bcrypt.compare(
      dto.currentPassword,
      currentUser.passwordHash,
    );

    if (!currentPasswordMatched) {
      throw new UnauthorizedException('当前密码不正确。');
    }

    const samePassword = await bcrypt.compare(dto.newPassword, currentUser.passwordHash);
    if (samePassword) {
      throw new BadRequestException('新密码不能与当前密码相同。');
    }

    await this.prisma.user.update({
      where: { id: currentUser.id },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, 10),
        tokenVersion: {
          increment: 1,
        },
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });
    this.clearRefreshTokenCookie(response);

    await this.auditLogsService.log({
      familyId: user.activeFamilyId ?? undefined,
      operatorId: user.sub,
      action: AuditAction.UPDATE,
      targetType: 'AUTH',
      targetId: user.sub,
      metadata: {
        operation: 'CHANGE_PASSWORD',
      },
    });

    return {
      success: true,
    };
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

  private userSessionInclude() {
    return {
      memberships: {
        where: {
          status: MembershipStatus.ACTIVE,
          family: {
            status: FamilyStatus.ACTIVE,
          },
        },
        include: {
          family: true,
        },
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }

  private async resolveCurrentFamily(
    user: {
      platformRole: PlatformRole;
      lastActiveFamilyId: string | null;
      memberships: Array<{
        familyId: string;
        role: UserRole;
        family: {
          id: string;
          status: FamilyStatus;
        };
      }>;
    },
    requestedFamilyId?: string,
    options?: {
      preferPlatformForSuper?: boolean;
    },
  ): Promise<CurrentFamilyContext> {
    const requestedId = requestedFamilyId?.trim();
    const memberships = user.memberships.filter(
      (membership) => membership.family.status === FamilyStatus.ACTIVE,
    );

    if (requestedId) {
      if (user.platformRole === PlatformRole.SUPER) {
        const family = memberships.find((membership) => membership.familyId === requestedId);
        if (!family) {
          const activeFamily = await this.prisma.family.findFirst({
            where: { id: requestedId, status: FamilyStatus.ACTIVE },
          });

          if (!activeFamily) {
            throw new ForbiddenException('目标家族不存在或已停用。');
          }
        }

        return {
          activeFamilyId: requestedId,
          familyRole: family?.role ?? UserRole.ADMIN,
        };
      }

      const membership = memberships.find((item) => item.familyId === requestedId);
      if (!membership) {
        throw new ForbiddenException('当前账号无权进入该家族。');
      }

      return {
        activeFamilyId: membership.familyId,
        familyRole: membership.role,
      };
    }

    if (user.platformRole === PlatformRole.SUPER && options?.preferPlatformForSuper) {
      return {
        activeFamilyId: null,
        familyRole: null,
      };
    }

    const lastActiveMembership = memberships.find(
      (membership) => membership.familyId === user.lastActiveFamilyId,
    );
    const selected = lastActiveMembership ?? memberships[0];

    if (selected) {
      return {
        activeFamilyId: selected.familyId,
        familyRole: selected.role,
      };
    }

    if (user.platformRole === PlatformRole.SUPER) {
      return {
        activeFamilyId: null,
        familyRole: null,
      };
    }

    throw new ForbiddenException('当前账号尚未加入任何家族。');
  }

  private serializeUser(
    user: {
      id: string;
      username: string;
      phone: string | null;
      displayName: string | null;
      platformRole: PlatformRole;
      role: UserRole;
      status: UserStatus;
      lastLoginAt: Date | null;
      createdAt: Date;
      memberships: Array<{
        familyId: string;
        role: UserRole;
        family: {
          id: string;
          name: string;
          status: FamilyStatus;
        };
      }>;
    },
    familyContext: CurrentFamilyContext,
  ) {
    const families = user.memberships.map((membership) => ({
      id: membership.family.id,
      name: membership.family.name,
      status: membership.family.status,
      role: membership.role,
    }));
    const currentFamily = familyContext.activeFamilyId
      ? (families.find((family) => family.id === familyContext.activeFamilyId) ?? {
          id: familyContext.activeFamilyId,
          name: '当前家族',
          status: FamilyStatus.ACTIVE,
          role: familyContext.familyRole ?? UserRole.ADMIN,
        })
      : null;

    return {
      id: user.id,
      username: user.username,
      phone: user.phone,
      displayName: user.displayName ?? user.username,
      platformRole: user.platformRole,
      role: familyContext.familyRole ?? user.role,
      familyRole: familyContext.familyRole,
      activeFamilyId: familyContext.activeFamilyId,
      currentFamily,
      families,
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
