import { IsOptional, IsString } from 'class-validator';

export class AdminDepositListQueryDto {
  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
