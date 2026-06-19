import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateWithdrawalDto {
  @IsString()
  assetCode!: string;

  @IsString()
  amount!: string;

  @IsString()
  method!: string;

  @IsOptional()
  @IsObject()
  destinationDetails?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  note?: string;

  @IsString()
  currentPassword!: string;
}
