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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MemberAssetCategory, UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  CreateMarriageDto,
  CreateMemberDto,
  CreateMemberEventDto,
  CreateQuickRelativeDto,
  MemberAssetQueryDto,
  MemberDuplicateCheckDto,
  MemberQueryDto,
  UpdateMemberAssetDto,
  UploadMemberAssetsDto,
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
  @Post('duplicate-check')
  duplicateCheck(@Body() dto: MemberDuplicateCheckDto) {
    return this.membersService.checkDuplicates(dto);
  }

  @Roles(UserRole.ADMIN)
  @Get('import-template')
  async downloadImportTemplate(
    @CurrentUser() _user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const buffer = await this.membersService.exportImportTemplate();
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent('家族成员导入模板.xlsx')}`,
    );
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.send(buffer);
  }

  @Roles(UserRole.ADMIN)
  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  importMembers(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.importMembers(file, user.sub);
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

  @Get(':id/assets')
  listAssets(@Param('id') id: string, @Query() query: MemberAssetQueryDto) {
    return this.membersService.listAssets(id, query);
  }

  @Get(':id/timeline')
  getTimeline(@Param('id') id: string) {
    return this.membersService.getTimeline(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateMemberDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.create(dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/quick-relatives')
  createQuickRelative(
    @Param('id') id: string,
    @Body() dto: CreateQuickRelativeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.createQuickRelative(id, dto, user.sub);
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
  @Post(':id/assets/photos')
  @UseInterceptors(
    FilesInterceptor('files', 12, {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  uploadPhotos(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadMemberAssetsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.uploadAssets(
      id,
      files,
      MemberAssetCategory.PHOTO,
      user.sub,
      dto,
    );
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/assets/documents')
  @UseInterceptors(
    FilesInterceptor('files', 12, {
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  uploadDocuments(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadMemberAssetsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.uploadAssets(
      id,
      files,
      MemberAssetCategory.DOCUMENT,
      user.sub,
      dto,
    );
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/events')
  createEvent(
    @Param('id') id: string,
    @Body() dto: CreateMemberEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.createEvent(id, dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/assets/:assetId')
  updateAsset(
    @Param('id') id: string,
    @Param('assetId') assetId: string,
    @Body() dto: UpdateMemberAssetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.updateAsset(id, assetId, dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id/assets/:assetId')
  removeAsset(
    @Param('id') id: string,
    @Param('assetId') assetId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.removeAsset(id, assetId, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id/events/:eventId')
  removeEvent(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.removeEvent(id, eventId, user.sub);
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
