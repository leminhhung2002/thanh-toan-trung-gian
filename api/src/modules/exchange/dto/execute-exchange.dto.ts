import { IsString } from 'class-validator';

export class ExecuteExchangeDto {
  @IsString()
  quoteId!: string;
}
