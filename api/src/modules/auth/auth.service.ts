import {
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { Request } from 'express';
import { AssetsService } from '../assets/assets.service';
import {
  APP_ROLES,
  ROLE_ADMIN,
  ROLE_SUPER_ADMIN,
  ROLE_USER,
} from '../iam/role.constants';
import {
  normalizeTelegramUsername,
  normalizeTelegramUsernameForRead,
} from '../users/telegram-username';
import { WalletsService } from '../wallets/wallets.service';
import { DatabaseService } from '../../platform/database/database.service';
import {
  authSessions,
  roles,
  userRoles,
  users,
} from '../../platform/database/schema';
import { AuthSessionTokensService } from './auth-session-tokens.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly authSessionTokensService: AuthSessionTokensService,
    private readonly walletsService: WalletsService,
  ) {}

  async onModuleInit() {
    await this.ensureSeedData();
  }

  async register(dto: RegisterDto, req: Request) {
    const existingUser = await this.findUserByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException({
        code: 'email_already_exists',
        message: 'Email này đã được sử dụng.',
      });
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const userId = randomUUID();
    const db = this.databaseService.db;

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email: dto.email.toLowerCase(),
        passwordHash,
        phone: dto.phone ?? null,
        telegram: normalizeTelegramUsername(dto.telegram),
      });

      const roleRows = await tx
        .select()
        .from(roles)
        .where(eq(roles.code, ROLE_USER));

      if (roleRows.length === 0) {
        throw new Error('Missing default user role');
      }

      await tx.insert(userRoles).values({
        userId,
        roleId: roleRows[0].id,
      });
    });

    const activeAssets = await this.assetsService.listActiveAssets();
    await this.walletsService.ensureWalletsForUser(
      userId,
      activeAssets.map((asset) => asset.id),
    );

    return this.createAuthResult(userId, dto.email.toLowerCase(), req);
  }

  async login(dto: LoginDto, req: Request) {
    const user = await this.findUserByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        code: 'invalid_credentials',
        message: 'Email hoặc mật khẩu không đúng.',
      });
    }

    const matches = await argon2.verify(user.passwordHash, dto.password);
    if (!matches) {
      throw new UnauthorizedException({
        code: 'invalid_credentials',
        message: 'Email hoặc mật khẩu không đúng.',
      });
    }

    return this.createAuthResult(user.id, user.email, req);
  }

  async refresh(refreshToken: string) {
    const { secret, sessionId } =
      this.authSessionTokensService.parseRefreshToken(refreshToken);
    const [session] = await this.databaseService.db
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, sessionId));

    if (!session || session.revokedAt) {
      throw new UnauthorizedException({
        code: 'refresh_token_invalid',
        message: 'Phiên đăng nhập không còn hợp lệ.',
      });
    }

    if (new Date(session.expiresAt) < new Date()) {
      throw new UnauthorizedException({
        code: 'refresh_token_expired',
        message: 'Phiên đăng nhập đã hết hạn.',
      });
    }

    const secretHash = this.authSessionTokensService.hashOpaqueToken(secret);
    if (secretHash !== session.refreshTokenHash) {
      throw new UnauthorizedException({
        code: 'refresh_token_invalid',
        message: 'Phiên đăng nhập không còn hợp lệ.',
      });
    }

    const user = await this.getUserById(session.userId);
    const roles = await this.getRoleCodesForUser(user.id);
    const rotatedSecret = this.authSessionTokensService.generateOpaqueToken();
    const rotatedHash =
      this.authSessionTokensService.hashOpaqueToken(rotatedSecret);

    await this.databaseService.db
      .update(authSessions)
      .set({
        refreshTokenHash: rotatedHash,
        lastUsedAt: new Date(),
      })
      .where(eq(authSessions.id, session.id));

    return {
      accessToken: await this.signAccessToken(
        user.id,
        user.email,
        roles,
        session.id,
      ),
      refreshToken: `${session.id}.${rotatedSecret}`,
    };
  }

  async logout(refreshToken: string) {
    const { sessionId } =
      this.authSessionTokensService.parseRefreshToken(refreshToken);

    await this.databaseService.db
      .update(authSessions)
      .set({
        revokedAt: new Date(),
      })
      .where(eq(authSessions.id, sessionId));
  }

  async getCurrentUser(userId: string) {
    const user = await this.getUserById(userId);
    const roleCodes = await this.getRoleCodesForUser(user.id);

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      roles: roleCodes,
      telegram: normalizeTelegramUsernameForRead(user.telegram),
      twoFactorEnabled: false,
    };
  }

  private async createAuthResult(userId: string, email: string, req?: Request) {
    const roleCodes = await this.getRoleCodesForUser(userId);
    const session = await this.createSession(userId, req);
    const wallets = await this.walletsService.listWalletsForUser(userId);

    return {
      accessToken: await this.signAccessToken(
        userId,
        email,
        roleCodes,
        session.sessionId,
      ),
      refreshToken: session.refreshToken,
      user: {
        id: userId,
        email,
        roles: roleCodes,
      },
      wallets,
    };
  }

  private async createSession(userId: string, request?: Request) {
    const sessionId = randomUUID();
    const secret = this.authSessionTokensService.generateOpaqueToken();
    const refreshTokenHash =
      this.authSessionTokensService.hashOpaqueToken(secret);
    const refreshToken = `${sessionId}.${secret}`;
    const expiresAt = new Date(
      Date.now() +
        this.configService.get<number>('REFRESH_TOKEN_TTL_DAYS', 30) *
          24 *
          60 *
          60 *
          1000,
    );

    await this.databaseService.db.insert(authSessions).values({
      id: sessionId,
      userId,
      refreshTokenHash,
      userAgent: request?.headers['user-agent'] ?? null,
      ipAddress: request?.ip ?? null,
      expiresAt,
      lastUsedAt: new Date(),
    });

    return {
      refreshToken,
      sessionId,
    };
  }

  private async signAccessToken(
    userId: string,
    email: string,
    roleCodes: string[],
    sessionId: string,
  ) {
    return this.jwtService.signAsync(
      {
        sub: userId,
        email,
        roles: roleCodes,
        sessionId,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_ACCESS_TTL',
          '15m',
        ) as never,
      },
    );
  }

  private async findUserByEmail(email: string) {
    const [user] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    return user ?? null;
  }

  private async getUserById(userId: string) {
    const [user] = await this.databaseService.db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.isActive, true)));

    if (!user) {
      throw new UnauthorizedException({
        code: 'user_not_found',
        message: 'Không tìm thấy người dùng.',
      });
    }

    return user;
  }

  private async getRoleCodesForUser(userId: string) {
    const rows = await this.databaseService.db
      .select({
        code: roles.code,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));

    return rows.map((row) => row.code);
  }

  private async ensureSeedData() {
    const db = this.databaseService.db;

    for (const role of APP_ROLES) {
      const [existingRole] = await db
        .select()
        .from(roles)
        .where(eq(roles.code, role.code));

      if (!existingRole) {
        await db.insert(roles).values({
          id: randomUUID(),
          code: role.code,
          name: role.name,
        });
      }
    }

    await this.assetsService.ensureSeededAssets();

    const adminEmail =
      this.configService.getOrThrow<string>('SUPER_ADMIN_EMAIL');
    let adminUser = await this.findUserByEmail(adminEmail);

    if (!adminUser) {
      const passwordHash = await argon2.hash(
        this.configService.getOrThrow<string>('SUPER_ADMIN_PASSWORD'),
        {
          type: argon2.argon2id,
        },
      );

      await db.insert(users).values({
        id: randomUUID(),
        email: adminEmail.toLowerCase(),
        passwordHash,
        phone: this.configService.get<string>('SUPER_ADMIN_PHONE', ''),
      });
      adminUser = await this.findUserByEmail(adminEmail);
    }

    if (!adminUser) {
      return;
    }

    const adminRoles = await db
      .select()
      .from(roles)
      .where(inArray(roles.code, [ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN]));

    const adminRoleAssignments = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, adminUser.id));
    const assignedRoleIds = new Set(
      adminRoleAssignments.map((row) => row.roleId),
    );

    const missingAssignments = adminRoles
      .filter((role) => !assignedRoleIds.has(role.id))
      .map((role) => ({
        userId: adminUser.id,
        roleId: role.id,
      }));

    if (missingAssignments.length > 0) {
      await db.insert(userRoles).values(missingAssignments);
    }

    const activeAssets = await this.assetsService.listActiveAssets();
    await this.walletsService.ensureWalletsForUser(
      adminUser.id,
      activeAssets.map((asset) => asset.id),
    );
  }
}
