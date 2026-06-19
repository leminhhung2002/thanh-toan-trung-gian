import { IsOptional, IsString } from 'class-validator';

export class ReviewWithdrawalDto {
  @IsOptional()
  @IsString()
  note?: string;
}
