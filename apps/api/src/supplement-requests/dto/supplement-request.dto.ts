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
import { MemberAssetMetadataDto } from '../../members/dto/member.dto';

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
