import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Max, Min } from 'class-validator';

export class UpdateAdminSettingsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  depositReservationTtlMinutes!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  exchangeVndToUsdtMarkupVnd!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  exchangeUsdtToVndMarkupVnd!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  exchangeVndToUsdtFeeBps!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  exchangeUsdtToVndFeeBps!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  withdrawalVndFeeBps!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  withdrawalUsdtFeeBps!: number;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  supportLink!: string;
}
