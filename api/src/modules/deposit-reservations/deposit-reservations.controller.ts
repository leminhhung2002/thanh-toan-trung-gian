import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../../platform/auth/access-token.guard';
import { CurrentUser } from '../../platform/auth/current-user.decorator';
import type { JwtPayload } from '../../platform/auth/jwt-payload.type';
import { CreateDepositReservationDto } from './dto/create-deposit-reservation.dto';
import { DepositReservationsService } from './deposit-reservations.service';

@Controller('deposit-reservations')
@UseGuards(AccessTokenGuard)
export class DepositReservationsController {
  constructor(
    private readonly depositReservationsService: DepositReservationsService,
  ) {}

  @Post()
  async createReservation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDepositReservationDto,
  ) {
    return {
      data: await this.depositReservationsService.create(
        {
          email: user.email,
          id: user.sub,
        },
        dto,
      ),
    };
  }

  @Get()
  async listReservations(@CurrentUser() user: JwtPayload) {
    return {
      data: await this.depositReservationsService.list(user.sub),
    };
  }

  @Get('current')
  async getCurrentReservation(@CurrentUser() user: JwtPayload) {
    return {
      data: await this.depositReservationsService.getCurrent(user.sub),
    };
  }

  @Post(':id/confirm')
  async confirmReservation(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return {
      data: await this.depositReservationsService.confirm(user.sub, id),
    };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelReservation(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return {
      data: await this.depositReservationsService.cancel(user.sub, id),
    };
  }
}
