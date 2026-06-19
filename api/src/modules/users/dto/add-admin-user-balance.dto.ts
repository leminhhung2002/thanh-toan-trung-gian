import { IsIn, IsString } from 'class-validator';

export class AddAdminUserBalanceDto {
  @IsString()
  amount!: string;

  @IsString()
  @IsIn(['VND', 'USDT'])
  assetCode!: 'VND' | 'USDT';
}
