import { ArrayMaxSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export class ReorderHomepageBannersDto {
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsString({ each: true })
  bannerIds!: string[];
}
