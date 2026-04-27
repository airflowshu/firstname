import { Gender } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class MemberToMemberDto {
  @IsString()
  sourceMemberId!: string;

  @IsString()
  targetMemberId!: string;
}

export class PathCalcDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  tokens!: string[];

  @IsOptional()
  @IsEnum(Gender)
  subjectGender?: Gender;

  @IsOptional()
  @IsBoolean()
  reverse?: boolean;
}

export class UpsertKinshipAliasDto {
  @IsString()
  relationCode!: string;

  @IsString()
  standardTerm!: string;

  @IsString()
  familyAlias!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
