import { IsOptional, IsString } from 'class-validator';

export class AdminExchangeListQueryDto {
  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  startDate?: string;
}
