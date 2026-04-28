import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MembersModule } from '../members/members.module';
import { SupplementRequestsController } from './supplement-requests.controller';
import { SupplementRequestsService } from './supplement-requests.service';

@Module({
  imports: [AuditLogsModule, MembersModule],
  controllers: [SupplementRequestsController],
  providers: [SupplementRequestsService],
})
export class SupplementRequestsModule {}
