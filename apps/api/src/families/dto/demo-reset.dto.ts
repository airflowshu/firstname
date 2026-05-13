import { IsString, MinLength } from 'class-validator';

export class DemoResetDto {
  @IsString()
  @MinLength(1)
  confirmationText!: string;
}
