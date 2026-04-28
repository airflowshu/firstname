import { PartialType } from '@nestjs/mapped-types';
import {
  Gender,
  LifeStatus,
  MarriageStatus,
  MemberAssetCategory,
  MemberEventType,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsDateString,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const MAX_MEMBER_ASSET_TAGS = 12;

function transformTagListInput(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalize = (input: unknown[]) =>
    Array.from(
      new Set(
        input
          .map((item) => String(item).trim())
          .filter(Boolean),
      ),
    ).slice(0, MAX_MEMBER_ASSET_TAGS);

  if (Array.isArray(value)) {
    return normalize(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return normalize(parsed);
      }
    } catch {
      // ignore json parse failure and fall back to split mode
    }

    return normalize(trimmed.split(/[,\n，]/));
  }

  return undefined;
}

export class CreateMemberDto {
  @IsString()
  @MaxLength(50)
  name!: string;

  @IsEnum(Gender)
  gender!: Gender;

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
  fatherId?: string;

  @IsOptional()
  @IsString()
  motherId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateMemberDto extends PartialType(CreateMemberDto) {}

export class MemberDuplicateCheckDto extends PartialType(CreateMemberDto) {
  @IsOptional()
  @IsString()
  excludeId?: string;
}

export class MemberQueryDto {
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
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsEnum(LifeStatus)
  lifeStatus?: LifeStatus;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  includeDeleted?: boolean = false;
}

export class CreateMarriageDto {
  @IsString()
  spouseId!: string;

  @IsOptional()
  @IsEnum(MarriageStatus)
  status?: MarriageStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateMarriageDto {
  @IsOptional()
  @IsEnum(MarriageStatus)
  status?: MarriageStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class CreateQuickRelativeDto {
  @IsIn(['father', 'mother', 'spouse', 'child', 'sibling'])
  relationType!: 'father' | 'mother' | 'spouse' | 'child' | 'sibling';

  @ValidateNested()
  @Type(() => CreateMemberDto)
  member!: CreateMemberDto;
}

export class MemberAssetQueryDto {
  @IsOptional()
  @IsEnum(MemberAssetCategory)
  category?: MemberAssetCategory;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  tag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  sourceType?: string;
}

export class MemberAssetLibraryQueryDto extends MemberAssetQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 24;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  hasSource?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  hasDescription?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  hasTags?: boolean;

  @IsOptional()
  @IsString()
  importBatchId?: string;
}

export class MemberAssetMetadataDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  sourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;

  @IsOptional()
  @Transform(({ value }) => transformTagListInput(value))
  @IsArray()
  @ArrayMaxSize(MAX_MEMBER_ASSET_TAGS)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UploadMemberAssetsDto extends MemberAssetMetadataDto {}

export class UpdateMemberAssetDto extends PartialType(MemberAssetMetadataDto) {}

export class CreateMemberEventDto {
  @IsEnum(MemberEventType)
  eventType!: MemberEventType;

  @IsString()
  @MaxLength(100)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsDateString()
  eventDate!: string;
}
