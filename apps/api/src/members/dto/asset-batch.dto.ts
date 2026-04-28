import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item).trim())
        .filter(Boolean),
    ),
  );
}

export class BatchAssetOperationDto {
  @IsIn(['APPEND_TAGS', 'SET_SOURCE_TYPE', 'DELETE'])
  action!: 'APPEND_TAGS' | 'SET_SOURCE_TYPE' | 'DELETE';

  @Transform(({ value }) => normalizeStringList(value))
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  assetIds!: string[];

  @IsOptional()
  @Transform(({ value }) => normalizeStringList(value))
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(30)
  sourceType?: string;
}
