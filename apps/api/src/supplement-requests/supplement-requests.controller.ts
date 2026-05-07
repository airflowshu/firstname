import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  CreateAssetMetadataChangeRequestDto,
  CreateEventChangeRequestDto,
  CreateMarriageChangeRequestDto,
  CreateMemberCreateRequestDto,
  CreateMemberDeleteRequestDto,
  CreateMemberImportRequestDto,
  CreateMemberPhotoRequestDto,
  CreateMemberUpdateRequestDto,
  CreateQuickRelativeRequestDto,
  CreateSupplementAssetRequestDto,
  CreateSupplementRequestDto,
  ReviewSupplementRequestDto,
  SupplementRequestQueryDto,
} from './dto/supplement-request.dto';
import { SupplementRequestsService } from './supplement-requests.service';

@Controller('supplement-requests')
export class SupplementRequestsController {
  constructor(private readonly supplementRequestsService: SupplementRequestsService) {}

  @Get()
  list(@Query() query: SupplementRequestQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.supplementRequestsService.list(query, user);
  }

  @Post()
  create(@Body() dto: CreateSupplementRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.supplementRequestsService.create(dto, user);
  }

  @Post('member-create')
  createMemberCreateRequest(
    @Body() dto: CreateMemberCreateRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplementRequestsService.createMemberCreateRequest(dto, user);
  }

  @Post('member-update')
  createMemberUpdateRequest(
    @Body() dto: CreateMemberUpdateRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplementRequestsService.createMemberUpdateRequest(dto, user);
  }

  @Post('member-delete')
  createMemberDeleteRequest(
    @Body() dto: CreateMemberDeleteRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplementRequestsService.createMemberDeleteRequest(dto, user);
  }

  @Post('member-restore')
  createMemberRestoreRequest(
    @Body() dto: CreateMemberDeleteRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplementRequestsService.createMemberRestoreRequest(dto, user);
  }

  @Post('quick-relative')
  createQuickRelativeRequest(
    @Body() dto: CreateQuickRelativeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplementRequestsService.createQuickRelativeRequest(dto, user);
  }

  @Post('marriage')
  createMarriageChangeRequest(
    @Body() dto: CreateMarriageChangeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplementRequestsService.createMarriageChangeRequest(dto, user);
  }

  @Post('member-photo')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  createMemberPhotoRequest(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateMemberPhotoRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplementRequestsService.createMemberPhotoRequest(dto, file, user);
  }

  @Post('assets')
  @UseInterceptors(
    FilesInterceptor('files', 12, {
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  createAssetRequest(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: CreateSupplementAssetRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplementRequestsService.createAssetRequest(dto, files, user);
  }

  @Post('asset-update')
  createAssetMetadataChangeRequest(
    @Body() dto: CreateAssetMetadataChangeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplementRequestsService.createAssetMetadataChangeRequest(dto, user);
  }

  @Post('event')
  createEventChangeRequest(
    @Body() dto: CreateEventChangeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplementRequestsService.createEventChangeRequest(dto, user);
  }

  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  createImportRequest(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateMemberImportRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplementRequestsService.createImportRequest(dto, file, user);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/review')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewSupplementRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplementRequestsService.review(id, dto, user);
  }
}
