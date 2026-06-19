import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../../platform/auth/access-token.guard';
import { CurrentUser } from '../../platform/auth/current-user.decorator';
import type { JwtPayload } from '../../platform/auth/jwt-payload.type';
import { Roles } from '../../platform/auth/roles.decorator';
import { RolesGuard } from '../../platform/auth/roles.guard';
import { ROLE_ADMIN, ROLE_SUPER_ADMIN } from '../iam/role.constants';
import { UsersService } from './users.service';
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto';
import { AddAdminUserBalanceDto } from './dto/add-admin-user-balance.dto';
import { OverwriteAdminUserBalancesDto } from './dto/overwrite-admin-user-balances.dto';
import { UpdateAdminUserPasswordDto } from './dto/update-admin-user-password.dto';
import { UpdateAdminUserProfileDto } from './dto/update-admin-user-profile.dto';
import { UpdateAdminUserRolesDto } from './dto/update-admin-user-roles.dto';

@Controller('admin/users')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(ROLE_ADMIN, ROLE_SUPER_ADMIN)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(@Query() query: AdminUserListQueryDto) {
    return {
      data: await this.usersService.listForAdmin(query),
    };
  }

  @Get('roles')
  async listRoles() {
    return {
      data: await this.usersService.listRoleOptions(),
    };
  }

  @Patch(':id/profile')
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserProfileDto,
  ) {
    return {
      data: await this.usersService.updateProfileByAdmin(user.sub, id, dto),
    };
  }

  @Patch(':id/roles')
  async updateRoles(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserRolesDto,
  ) {
    return {
      data: await this.usersService.updateRolesByAdmin(
        user.sub,
        user.roles,
        id,
        dto,
      ),
    };
  }

  @Patch(':id/password')
  async updatePassword(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserPasswordDto,
  ) {
    return {
      data: await this.usersService.setPasswordByAdmin(user.sub, id, dto),
    };
  }

  @Patch(':id/balances')
  async overwriteBalances(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: OverwriteAdminUserBalancesDto,
  ) {
    return {
      data: await this.usersService.overwriteBalancesByAdmin(user.sub, id, dto),
    };
  }

  @Post(':id/add-balance')
  @HttpCode(HttpStatus.CREATED)
  async addBalance(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddAdminUserBalanceDto,
  ) {
    return {
      data: await this.usersService.addBalanceByAdmin(user.sub, id, dto),
    };
  }

}
