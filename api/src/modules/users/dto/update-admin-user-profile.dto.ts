import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateAdminUserProfileDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  telegram?: string;
}
