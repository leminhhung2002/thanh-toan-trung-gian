import { IsString } from 'class-validator';

export class CreateQuoteDto {
  @IsString()
  fromAssetCode!: string;

  @IsString()
  toAssetCode!: string;

  @IsString()
  amount!: string;
}
