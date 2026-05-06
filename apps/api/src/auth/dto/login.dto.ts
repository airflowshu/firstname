import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(50)
  password!: string;

  @IsOptional()
  @IsString()
  familyId?: string;
}

export class SwitchFamilyDto {
  @IsString()
  familyId!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(50)
  newPassword!: string;
}
