import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../../platform/auth/access-token.guard';
import { CurrentUser } from '../../platform/auth/current-user.decorator';
import type { JwtPayload } from '../../platform/auth/jwt-payload.type';
import { Roles } from '../../platform/auth/roles.decorator';
import { RolesGuard } from '../../platform/auth/roles.guard';
import { parseVietnamDateRangeQuery } from '../../platform/time/vietnam-date-range-query';
import { ROLE_ADMIN, ROLE_SUPER_ADMIN } from '../iam/role.constants';
import { AdminExchangeListQueryDto } from './dto/admin-exchange-list-query.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ExecuteExchangeDto } from './dto/execute-exchange.dto';
import { ExchangeService } from './exchange.service';

@Controller('exchange')
@UseGuards(AccessTokenGuard)
export class ExchangeController {
  constructor(private readonly exchangeService: ExchangeService) {}

  @Get('orders')
  async listOrders(@CurrentUser() user: JwtPayload) {
    return {
      data: await this.exchangeService.listForUser(user.sub),
    };
  }

  @Post('quote')
  async createQuote(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateQuoteDto,
  ) {
    return {
      data: await this.exchangeService.createQuote(user.sub, dto),
    };
  }

  @Post('execute')
  async executeExchange(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ExecuteExchangeDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new UnauthorizedException({
        code: 'missing_idempotency_key',
        message: 'Thiếu tiêu đề Idempotency-Key.',
      });
    }

    return {
      data: await this.exchangeService.execute(
        user.sub,
        dto.quoteId,
        idempotencyKey,
      ),
    };
  }
}

@Controller('admin/exchange')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(ROLE_ADMIN, ROLE_SUPER_ADMIN)
export class AdminExchangeController {
  constructor(private readonly exchangeService: ExchangeService) {}

  @Get('orders')
  async listOrders(@Query() query: AdminExchangeListQueryDto) {
    return {
      data: await this.exchangeService.listForAdmin(
        parseVietnamDateRangeQuery(query.startDate, query.endDate),
        query.search,
      ),
    };
  }

  @Post('orders/:id/reverse')
  async reverseOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return {
      data: await this.exchangeService.reverse(user.sub, id),
    };
  }
}
