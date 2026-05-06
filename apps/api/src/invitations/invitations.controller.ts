import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PlatformRole, UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PlatformRoles } from '../common/decorators/platform-roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  AcceptInvitationDto,
  CreateFamilyAdminInvitationDto,
  CreateFamilyMemberInvitationDto,
} from './dto/invitation.dto';
import { InvitationsService } from './invitations.service';

@Controller()
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @PlatformRoles(PlatformRole.SUPER)
  @Post('platform/invitations/family-admin')
  createFamilyAdminInvitation(
    @Body() dto: CreateFamilyAdminInvitationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invitationsService.createFamilyAdminInvitation(dto, user);
  }

  @Roles(UserRole.ADMIN)
  @Post('families/current/invitations/members')
  createFamilyMemberInvitation(
    @Body() dto: CreateFamilyMemberInvitationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invitationsService.createFamilyMemberInvitation(dto, user);
  }

  @Public()
  @Get('invitations/:code')
  inspect(@Param('code') code: string) {
    return this.invitationsService.inspect(code);
  }

  @Public()
  @Post('invitations/:code/accept')
  accept(@Param('code') code: string, @Body() dto: AcceptInvitationDto) {
    return this.invitationsService.accept(code, dto);
  }
}
