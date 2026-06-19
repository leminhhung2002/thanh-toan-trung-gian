import { IsString, MinLength } from 'class-validator';

export class UpdateAdminUserPasswordDto {
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
