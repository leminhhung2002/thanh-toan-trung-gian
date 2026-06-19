import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
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
import { AdminDepositListQueryDto } from './dto/admin-deposit-list-query.dto';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { ReviewDepositDto } from './dto/review-deposit.dto';
import { DepositsService } from './deposits.service';

const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'all'] as const;
type ReviewStatus = (typeof REVIEW_STATUSES)[number];

function getReviewStatus(status?: string): ReviewStatus {
  if (!status) {
    return 'pending';
  }

  if (REVIEW_STATUSES.includes(status as ReviewStatus)) {
    return status as ReviewStatus;
  }

  throw new BadRequestException({
    code: 'invalid_review_status',
    message: `Trạng thái duyệt chỉ được phép là: ${REVIEW_STATUSES.join(', ')}.`,
  });
}

@Controller('deposits')
@UseGuards(AccessTokenGuard)
export class DepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @Post()
  async createDeposit(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDepositDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new UnauthorizedException({
        code: 'missing_idempotency_key',
        message: 'Thiếu tiêu đề Idempotency-Key.',
      });
    }

    return {
      data: await this.depositsService.create(user.sub, dto, idempotencyKey),
    };
  }

  @Get()
  async listDeposits(@CurrentUser() user: JwtPayload) {
    return {
      data: await this.depositsService.listForUser(user.sub),
    };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelDeposit(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return {
      data: await this.depositsService.cancel(user.sub, id),
    };
  }
}

@Controller('admin/deposits')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(ROLE_ADMIN, ROLE_SUPER_ADMIN)
export class AdminDepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @Get()
  async list(@Query() query: AdminDepositListQueryDto) {
    return {
      data: await this.depositsService.listForAdmin(
        getReviewStatus(query.status),
        parseVietnamDateRangeQuery(query.startDate, query.endDate),
        query.search,
      ),
    };
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReviewDepositDto,
  ) {
    return {
      data: await this.depositsService.approve(user.sub, id, dto.note),
    };
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReviewDepositDto,
  ) {
    return {
      data: await this.depositsService.reject(user.sub, id, dto.note),
    };
  }

  @Post(':id/restore-pending')
  @HttpCode(HttpStatus.OK)
  async restorePending(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return {
      data: await this.depositsService.restorePending(user.sub, id),
    };
  }
}
