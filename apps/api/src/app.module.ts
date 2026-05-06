import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PlatformRolesGuard } from './common/guards/platform-roles.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantContextInterceptor } from './common/tenant/tenant-context.interceptor';
import configuration from './config/configuration';
import { DashboardModule } from './dashboard/dashboard.module';
import { FamiliesModule } from './families/families.module';
import { GraphModule } from './graph/graph.module';
import { InvitationsModule } from './invitations/invitations.module';
import { KinshipModule } from './kinship/kinship.module';
import { MembersModule } from './members/members.module';
import { PrismaModule } from './prisma/prisma.module';
import { SupplementRequestsModule } from './supplement-requests/supplement-requests.module';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['../../.env', '.env'],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('globalThrottleTtlMs', 60_000),
            limit: configService.get<number>('globalThrottleLimit', 120),
          },
        ],
      }),
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 60_000,
      max: 100,
    }),
    PrismaModule,
    AuditLogsModule,
    AuthModule,
    UsersModule,
    MembersModule,
    SupplementRequestsModule,
    DashboardModule,
    FamiliesModule,
    GraphModule,
    KinshipModule,
    InvitationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PlatformRolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
})
export class AppModule {}
