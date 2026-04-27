import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { KinshipController } from './kinship.controller';
import { KinshipService } from './kinship.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [KinshipController],
  providers: [KinshipService],
})
export class KinshipModule {}
