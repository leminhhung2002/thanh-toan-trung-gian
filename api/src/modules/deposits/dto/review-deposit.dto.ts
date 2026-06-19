import { IsOptional, IsString } from 'class-validator';

export class ReviewDepositDto {
  @IsOptional()
  @IsString()
  note?: string;
}
