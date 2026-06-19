import { IsOptional, IsString } from 'class-validator';

export class CreateDepositDto {
  @IsString()
  assetCode!: string;

  @IsString()
  amount!: string;

  @IsString()
  method!: string;

  @IsOptional()
  @IsString()
  destinationRef?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  proofUrl?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
