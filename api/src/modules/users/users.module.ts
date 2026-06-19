import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { AuditModule } from '../audit/audit.module';
import { LedgerModule } from '../ledger/ledger.module';
import { WalletsModule } from '../wallets/wallets.module';
import { AdminUsersController } from './admin-users.controller';
import { PasswordConfirmationService } from './password-confirmation.service';
import { ProfileController } from './profile.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AssetsModule, AuditModule, LedgerModule, WalletsModule],
  controllers: [ProfileController, AdminUsersController],
  providers: [UsersService, PasswordConfirmationService],
  exports: [UsersService, PasswordConfirmationService],
})
export class UsersModule {}
