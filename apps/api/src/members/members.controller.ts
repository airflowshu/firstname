import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  CreateMarriageDto,
  CreateMemberDto,
  MemberQueryDto,
  UpdateMarriageDto,
  UpdateMemberDto,
} from './dto/member.dto';
import { MembersService } from './members.service';

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  list(@Query() query: MemberQueryDto) {
    return this.membersService.list(query);
  }

  @Get('options')
  options(@Query('keyword') keyword?: string) {
    return this.membersService.options(keyword);
  }

  @Roles(UserRole.ADMIN)
  @Get('export')
  async exportMembers(@CurrentUser() user: AuthenticatedUser, @Res() response: Response) {
    const buffer = await this.membersService.exportMembers(user.sub);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent('家族成员导出.xlsx')}`,
    );
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    response.send(buffer);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.membersService.getById(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateMemberDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.create(dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.update(id, dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.remove(id, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.restore(id, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/photo')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.uploadPhoto(id, file, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/marriages')
  createMarriage(
    @Param('id') id: string,
    @Body() dto: CreateMarriageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.createMarriage(id, dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/marriages/:marriageId')
  updateMarriage(
    @Param('id') id: string,
    @Param('marriageId') marriageId: string,
    @Body() dto: UpdateMarriageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.updateMarriage(id, marriageId, dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id/marriages/:marriageId')
  removeMarriage(
    @Param('id') id: string,
    @Param('marriageId') marriageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.removeMarriage(id, marriageId, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/marriages/:marriageId/restore')
  restoreMarriage(
    @Param('id') id: string,
    @Param('marriageId') marriageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.restoreMarriage(id, marriageId, user.sub);
  }
}
