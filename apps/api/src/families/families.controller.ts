import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { PlatformRoles } from '../common/decorators/platform-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { DemoResetService } from '../demo-reset/demo-reset.service';
import { DemoResetDto } from './dto/demo-reset.dto';
import { FamiliesService } from './families.service';

@Controller('platform/families')
@PlatformRoles(PlatformRole.SUPER)
export class FamiliesController {
  constructor(
    private readonly familiesService: FamiliesService,
    private readonly demoResetService: DemoResetService,
  ) {}

  @Get()
  list() {
    return this.familiesService.listPlatformFamilies();
  }

  @Get(':familyId/demo-reset-preview')
  previewDemoReset(@Param('familyId') familyId: string) {
    return this.demoResetService.preview(familyId);
  }

  @Post(':familyId/demo-reset')
  resetDemoFamily(
    @Param('familyId') familyId: string,
    @Body() dto: DemoResetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.demoResetService.reset(familyId, dto.confirmationText, user);
  }
}
