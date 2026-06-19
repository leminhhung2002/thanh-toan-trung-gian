import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../../platform/auth/access-token.guard';
import { CurrentUser } from '../../platform/auth/current-user.decorator';
import type { JwtPayload } from '../../platform/auth/jwt-payload.type';
import { WalletsService } from './wallets.service';

@Controller('wallets')
@UseGuards(AccessTokenGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  async listWallets(@CurrentUser() user: JwtPayload) {
    const wallets = await this.walletsService.listWalletsForUser(user.sub);

    return {
      data: wallets,
    };
  }

  @Get(':assetCode/ledger')
  async getLedger(
    @CurrentUser() user: JwtPayload,
    @Param('assetCode') assetCode: string,
  ) {
    const ledger = await this.walletsService.getLedgerForUser(
      user.sub,
      assetCode,
    );

    return {
      data: ledger,
    };
  }
}
