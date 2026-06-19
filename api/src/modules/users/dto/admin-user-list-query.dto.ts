import { IsOptional, IsString } from 'class-validator';

export class AdminUserListQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}
