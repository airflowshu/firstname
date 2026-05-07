import {
  Gender,
  LifeStatus,
  MemberAssetCategory,
  SupplementRequestStatus,
  SupplementRequestType,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CreateMarriageDto,
  CreateMemberDto,
  CreateMemberEventDto,
  CreateQuickRelativeDto,
  MemberAssetMetadataDto,
  UpdateMarriageDto,
  UpdateMemberAssetDto,
  UpdateMemberDto,
} from '../../members/dto/member.dto';

function transformEnumText(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class SupplementMemberPatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsDateString()
  deathDate?: string;

  @IsOptional()
  @IsEnum(LifeStatus)
  lifeStatus?: LifeStatus;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  generationName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  birthOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nativePlace?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateSupplementRequestDto {
  @IsString()
  memberId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;

  @ValidateNested()
  @Type(() => SupplementMemberPatchDto)
  patch!: SupplementMemberPatchDto;
}

export class ChangeRequestReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class CreateMemberCreateRequestDto extends ChangeRequestReasonDto {
  @ValidateNested()
  @Type(() => CreateMemberDto)
  member!: CreateMemberDto;
}

export class CreateMemberUpdateRequestDto extends ChangeRequestReasonDto {
  @IsString()
  memberId!: string;

  @ValidateNested()
  @Type(() => UpdateMemberDto)
  patch!: UpdateMemberDto;
}

export class CreateMemberDeleteRequestDto extends ChangeRequestReasonDto {
  @IsString()
  memberId!: string;
}

export class CreateQuickRelativeRequestDto extends ChangeRequestReasonDto {
  @IsString()
  memberId!: string;

  @ValidateNested()
  @Type(() => CreateQuickRelativeDto)
  request!: CreateQuickRelativeDto;
}

export class CreateMarriageChangeRequestDto extends ChangeRequestReasonDto {
  @IsString()
  memberId!: string;

  @IsIn(['CREATE', 'UPDATE', 'DELETE', 'RESTORE'])
  action!: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';

  @IsOptional()
  @IsString()
  marriageId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateMarriageDto)
  create?: CreateMarriageDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateMarriageDto)
  update?: UpdateMarriageDto;
}

export class CreateMemberPhotoRequestDto extends ChangeRequestReasonDto {
  @IsString()
  memberId!: string;
}

export class CreateAssetMetadataChangeRequestDto extends ChangeRequestReasonDto {
  @IsString()
  memberId!: string;

  @IsString()
  assetId!: string;

  @IsIn(['UPDATE', 'DELETE'])
  action!: 'UPDATE' | 'DELETE';

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateMemberAssetDto)
  patch?: UpdateMemberAssetDto;
}

export class CreateEventChangeRequestDto extends ChangeRequestReasonDto {
  @IsString()
  memberId!: string;

  @IsIn(['CREATE', 'DELETE'])
  action!: 'CREATE' | 'DELETE';

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateMemberEventDto)
  event?: CreateMemberEventDto;
}

export class CreateMemberImportRequestDto extends ChangeRequestReasonDto {}

export class ReviewSupplementRequestDto {
  @IsIn(['APPROVE', 'REJECT'])
  action!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reviewComment?: string;
}

export class CreateSupplementAssetRequestDto extends MemberAssetMetadataDto {
  @IsString()
  memberId!: string;

  @Transform(({ value }) => transformEnumText(value))
  @IsEnum(MemberAssetCategory)
  category!: MemberAssetCategory;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class SupplementRequestQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;

  @IsOptional()
  @Transform(({ value }) => transformEnumText(value))
  @IsEnum(SupplementRequestStatus)
  status?: SupplementRequestStatus;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Transform(({ value }) => transformEnumText(value))
  @IsEnum(SupplementRequestType)
  requestType?: SupplementRequestType;
}
