import {
  Body,
  Controller,
  Get,
  Param,
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
import {
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
