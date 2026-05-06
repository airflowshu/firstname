import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { BatchAssetOperationDto } from './dto/asset-batch.dto';
import {
  AssetImportBatchQueryDto,
  AssetImportPrecheckDto,
  ImportAssetBatchDto,
} from './dto/asset-import.dto';
import { AssetSourceQueryDto, UpsertAssetSourceDto } from './dto/asset-source.dto';
import { AssetTagQueryDto, UpsertAssetTagDto } from './dto/asset-tag.dto';
import { MemberAssetLibraryQueryDto } from './dto/member.dto';
import { MembersService } from './members.service';

@Controller('assets')
export class AssetsController {
  constructor(private readonly membersService: MembersService) {}

  @Get('tags')
  listAssetTags(@Query() query: AssetTagQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.listAssetTags(query, user);
  }

  @Roles(UserRole.ADMIN)
  @Post('tags')
  createAssetTag(@Body() dto: UpsertAssetTagDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.createAssetTag(dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Patch('tags/:id')
  updateAssetTag(
    @Param('id') id: string,
    @Body() dto: UpsertAssetTagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.updateAssetTag(id, dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Delete('tags/:id')
  removeAssetTag(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.removeAssetTag(id, user.sub);
  }

  @Get('sources')
  listAssetSources(@Query() query: AssetSourceQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.listAssetSources(query, user);
  }

  @Roles(UserRole.ADMIN)
  @Post('sources')
  createAssetSource(@Body() dto: UpsertAssetSourceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.createAssetSource(dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Patch('sources/:id')
  updateAssetSource(
    @Param('id') id: string,
    @Body() dto: UpsertAssetSourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.updateAssetSource(id, dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Delete('sources/:id')
  removeAssetSource(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.removeAssetSource(id, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Post('batch')
  batchOperateAssets(@Body() dto: BatchAssetOperationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.batchOperateAssets(dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Post('import-precheck')
  @UseInterceptors(
    FilesInterceptor('files', 12, {
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  importPrecheck(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: AssetImportPrecheckDto,
  ) {
    return this.membersService.precheckAssetImport(dto, files);
  }

  @Roles(UserRole.ADMIN)
  @Post('import-batch')
  @UseInterceptors(
    FilesInterceptor('files', 12, {
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  importBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: ImportAssetBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.importAssetsBatch(dto, files, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Get('import-batches')
  listImportBatches(@Query() query: AssetImportBatchQueryDto) {
    return this.membersService.listAssetImportBatches(query);
  }

  @Get()
  listLibraryAssets(@Query() query: MemberAssetLibraryQueryDto) {
    return this.membersService.listLibraryAssets(query);
  }
}
