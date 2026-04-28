import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { MemberAssetCategory } from '@prisma/client';
import { MemberAssetMetadataDto } from './member.dto';

function transformStringArray(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter(Boolean);
      }
    } catch {
      return [trimmed];
    }
  }

  return undefined;
}

export class ImportAssetBatchDto extends MemberAssetMetadataDto {
  @IsString()
  memberId!: string;

  @IsEnum(MemberAssetCategory)
  category!: MemberAssetCategory;

  @IsOptional()
  @Transform(({ value }) => transformStringArray(value))
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  titles?: string[];
}

export class AssetImportBatchQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 8;
}
