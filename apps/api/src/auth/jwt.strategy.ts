import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { FamilyStatus, MembershipStatus, PlatformRole, UserRole, UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwtSecret'),
    });
  }

  async validate(payload: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        role: true,
        phone: true,
        displayName: true,
        platformRole: true,
        lastActiveFamilyId: true,
        status: true,
        tokenVersion: true,
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
        },
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('登录状态已失效，请重新登录。');
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('登录状态已失效，请重新登录。');
    }

    const activeFamilyId = payload.activeFamilyId ?? user.lastActiveFamilyId ?? null;
    const membership = activeFamilyId
      ? user.memberships.find((item) => item.familyId === activeFamilyId)
      : undefined;

    if (activeFamilyId && !membership && user.platformRole !== PlatformRole.SUPER) {
      throw new UnauthorizedException('当前账号无权进入该家族。');
    }

    if (!activeFamilyId && user.platformRole !== PlatformRole.SUPER) {
      throw new UnauthorizedException('当前账号尚未加入任何家族。');
    }

    return {
      sub: user.id,
      username: user.username,
      phone: user.phone,
      displayName: user.displayName,
      platformRole: user.platformRole,
      activeFamilyId,
      familyRole:
        membership?.role ?? (user.platformRole === PlatformRole.SUPER ? UserRole.ADMIN : null),
      role:
        membership?.role ?? (user.platformRole === PlatformRole.SUPER ? UserRole.ADMIN : user.role),
      tokenVersion: user.tokenVersion,
    } satisfies AuthenticatedUser;
  }
}
