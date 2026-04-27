import { PartialType } from '@nestjs/mapped-types';
import { UserRole, UserStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(50)
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}
