import { Controller, Get } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { PlatformRoles } from '../common/decorators/platform-roles.decorator';
import { FamiliesService } from './families.service';

@Controller('platform/families')
@PlatformRoles(PlatformRole.SUPER)
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  @Get()
  list() {
    return this.familiesService.listPlatformFamilies();
  }
}
