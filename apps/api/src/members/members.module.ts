import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AssetsController } from './assets.controller';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [MembersController, AssetsController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
