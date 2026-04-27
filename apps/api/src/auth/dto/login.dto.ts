import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(50)
  password!: string;
}
