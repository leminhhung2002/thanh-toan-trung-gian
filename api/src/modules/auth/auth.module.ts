import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AssetsModule } from '../assets/assets.module';
import { WalletsModule } from '../wallets/wallets.module';
import { AuthController } from './auth.controller';
import { AuthSessionTokensService } from './auth-session-tokens.service';
import { AuthService } from './auth.service';
import { AccessTokenStrategy } from '../../platform/auth/access-token.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    AssetsModule,
    WalletsModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthSessionTokensService, AccessTokenStrategy],
  exports: [AuthService],
})
export class AuthModule {}
