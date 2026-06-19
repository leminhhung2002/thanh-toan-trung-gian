import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../../platform/auth/access-token.guard';
import { CurrentUser } from '../../platform/auth/current-user.decorator';
import type { JwtPayload } from '../../platform/auth/jwt-payload.type';
import { Roles } from '../../platform/auth/roles.decorator';
import { RolesGuard } from '../../platform/auth/roles.guard';
import { ROLE_ADMIN, ROLE_SUPER_ADMIN } from '../iam/role.constants';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

@Controller('admin/bank-accounts')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(ROLE_ADMIN, ROLE_SUPER_ADMIN)
export class AdminBankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Get()
  async list() {
    return {
      data: await this.bankAccountsService.listForAdmin(),
    };
  }

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBankAccountDto,
  ) {
    return {
      data: await this.bankAccountsService.create(user.sub, dto),
    };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return {
      data: await this.bankAccountsService.update(user.sub, id, dto),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return {
      data: await this.bankAccountsService.remove(user.sub, id),
    };
  }

  @Post('reset-daily-usage')
  @HttpCode(HttpStatus.OK)
  async resetDailyUsage(@CurrentUser() user: JwtPayload) {
    return {
      data: await this.bankAccountsService.resetDailyUsage(user.sub),
    };
  }
}
