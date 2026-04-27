import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditLogsService } from './audit-logs.service';

@Controller('audit-logs')
@Roles(UserRole.ADMIN)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.auditLogsService.list(
      Number.parseInt(page ?? '1', 10),
      Number.parseInt(pageSize ?? '10', 10),
      keyword,
    );
  }
}
