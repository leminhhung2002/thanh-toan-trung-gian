import { IsOptional, IsString } from 'class-validator';

export class OverwriteAdminUserBalancesDto {
  @IsOptional()
  @IsString()
  vnd?: string;

  @IsOptional()
  @IsString()
  usdt?: string;
}
