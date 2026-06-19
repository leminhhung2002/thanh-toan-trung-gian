import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class UpdateTelegramRuntimeConfigDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  chatId!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  token?: string;
}
