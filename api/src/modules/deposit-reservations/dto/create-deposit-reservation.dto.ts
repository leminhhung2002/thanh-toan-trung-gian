import { IsString } from 'class-validator';

export class CreateDepositReservationDto {
  @IsString()
  assetCode!: string;

  @IsString()
  amount!: string;

  @IsString()
  method!: string;
}
