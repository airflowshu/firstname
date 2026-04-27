import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { MemberToMemberDto, PathCalcDto, UpsertKinshipAliasDto } from './dto/kinship.dto';
import { KinshipService } from './kinship.service';

@Controller('kinship')
export class KinshipController {
  constructor(private readonly kinshipService: KinshipService) {}

  @Post('member-to-member')
  memberToMember(@Body() dto: MemberToMemberDto) {
    return this.kinshipService.memberToMember(dto);
  }

  @Post('path-calc')
  pathCalc(@Body() dto: PathCalcDto) {
    return this.kinshipService.pathCalc(dto);
  }

  @Get('aliases')
  listAliases() {
    return this.kinshipService.listAliases();
  }

  @Roles(UserRole.ADMIN)
  @Post('aliases')
  createAlias(@Body() dto: UpsertKinshipAliasDto, @CurrentUser() user: AuthenticatedUser) {
    return this.kinshipService.createAlias(dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Patch('aliases/:id')
  updateAlias(
    @Param('id') id: string,
    @Body() dto: UpsertKinshipAliasDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kinshipService.updateAlias(id, dto, user.sub);
  }
}
