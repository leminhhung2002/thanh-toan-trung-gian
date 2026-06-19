import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class UpdateAdminUserRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  roles!: string[];
}
