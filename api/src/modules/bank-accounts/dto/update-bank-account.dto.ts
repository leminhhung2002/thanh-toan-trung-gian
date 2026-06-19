import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Min } from 'class-validator';

export class UpdateBankAccountDto {
  @IsString()
  bankCode!: string;

  @IsString()
  bankName!: string;

  @IsString()
  accountNumber!: string;

  @IsString()
  accountName!: string;

  @IsString()
  dailyLimit!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  priority!: number;

  @Type(() => Boolean)
  @IsBoolean()
  isActive!: boolean;
}
