import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { AssetsModule } from './modules/assets/assets.module';
import { BankAccountsModule } from './modules/bank-accounts/bank-accounts.module';
import { DepositsModule } from './modules/deposits/deposits.module';
import { DepositReservationsModule } from './modules/deposit-reservations/deposit-reservations.module';
import { ExchangeModule } from './modules/exchange/exchange.module';
import { HealthModule } from './modules/health/health.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { UsersModule } from './modules/users/users.module';
import { UserNotificationsModule } from './modules/user-notifications/user-notifications.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TelegramRuntimeConfigModule } from './modules/telegram-runtime-config/telegram-runtime-config.module';
import { AccessTokenGuard } from './platform/auth/access-token.guard';
import { RolesGuard } from './platform/auth/roles.guard';
import { validateEnv } from './platform/config/env.validation';
import { DatabaseModule } from './platform/database/database.module';
import { RequestContextMiddleware } from './platform/http/request-context.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuditModule,
    HealthModule,
    IdempotencyModule,
    LedgerModule,
    NotificationsModule,
    TelegramRuntimeConfigModule,
    AssetsModule,
    BankAccountsModule,
    SettingsModule,
    WalletsModule,
    AuthModule,
    UsersModule,
    UserNotificationsModule,
    DepositsModule,
    DepositReservationsModule,
    WithdrawalsModule,
    ExchangeModule,
  ],
  providers: [AccessTokenGuard, RolesGuard],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
