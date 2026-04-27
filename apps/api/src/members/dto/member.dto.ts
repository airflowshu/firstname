import { PartialType } from '@nestjs/mapped-types';
import { Gender, LifeStatus, MarriageStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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
