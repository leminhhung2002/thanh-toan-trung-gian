import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { APP_ROLES, ROLE_SUPER_ADMIN } from '../iam/role.constants';
import { AssetsService } from '../assets/assets.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletsService } from '../wallets/wallets.service';
import {
  AdminUserSummary,
  AssetWalletRow,
  buildAdminUserSummary,
} from './admin-user-summary';
import { DatabaseService } from '../../platform/database/database.service';
import { AppTransaction } from '../../platform/database/database.types';
import {
  INVALID_AMOUNT_MESSAGE,
  NON_NEGATIVE_AMOUNT_MESSAGE,
  TOO_MANY_DECIMAL_PLACES_MESSAGE,
  fromMinorUnits,
  parsePositiveAmountToMinorUnits,
  toMinorUnits,
} from '../../platform/money/amounts';
import {
  assets,
  depositRequests,
  roles,
  userRoles,
  users,
  wallets,
  withdrawalRequests,
} from '../../platform/database/schema';
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto';
import { AddAdminUserBalanceDto } from './dto/add-admin-user-balance.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { OverwriteAdminUserBalancesDto } from './dto/overwrite-admin-user-balances.dto';
import {
  normalizeTelegramUsername,
  normalizeTelegramUsernameForRead,
} from './telegram-username';
import { matchesAdminUserSearch, normalizeAdminUserSearch } from './admin-user-search';
import { UpdateAdminUserPasswordDto } from './dto/update-admin-user-password.dto';
import { UpdateAdminUserProfileDto } from './dto/update-admin-user-profile.dto';
import { UpdateAdminUserRolesDto } from './dto/update-admin-user-roles.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PasswordConfirmationService } from './password-confirmation.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly auditService: AuditService,
    private readonly databaseService: DatabaseService,
    private readonly ledgerService: LedgerService,
    private readonly passwordConfirmationService: PasswordConfirmationService,
    private readonly walletsService: WalletsService,
  ) {}

  async getProfile(userId: string) {
    const [user] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new NotFoundException({
        code: 'user_not_found',
        message: 'Không tìm thấy người dùng.',
      });
    }

    const roleRows = await this.databaseService.db
      .select({
        code: roles.code,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      roles: roleRows.map((row) => row.code),
      telegram: normalizeTelegramUsernameForRead(user.telegram),
      twoFactorEnabled: false,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const [user] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new NotFoundException({
        code: 'user_not_found',
        message: 'Không tìm thấy người dùng.',
      });
    }

    const nextPhone =
      dto.phone === undefined ? (user.phone ?? null) : dto.phone.trim() || null;
    const currentTelegram = normalizeTelegramUsernameForRead(user.telegram);
    const nextTelegram =
      dto.telegram === undefined
        ? currentTelegram
        : normalizeTelegramUsername(dto.telegram);
    const phoneChanged = (user.phone ?? null) !== nextPhone;
    const telegramChanged = currentTelegram !== nextTelegram;

    if (phoneChanged || telegramChanged) {
      await this.passwordConfirmationService.assertValidCurrentPassword(
        userId,
        dto.currentPassword,
      );
    }

    await this.databaseService.db
      .update(users)
      .set({
        phone: nextPhone,
        telegram: nextTelegram,
      })
      .where(eq(users.id, userId));

    return this.getProfile(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const [user] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new NotFoundException({
        code: 'user_not_found',
        message: 'Không tìm thấy người dùng.',
      });
    }

    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new UnauthorizedException({
        code: 'current_password_invalid',
        message: 'Mật khẩu hiện tại không đúng.',
      });
    }

    const newPasswordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });

    await this.databaseService.db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
      })
      .where(eq(users.id, userId));

    return {
      success: true,
    };
  }

  async getTwoFactorStatus(userId: string) {
    await this.getExistingUser(userId);

    return {
      enabled: false,
      hasPendingSetup: false,
      recoveryMode: 'admin_reset' as const,
    };
  }

  async listUsers() {
    const userRows = await this.databaseService.db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));

    const roleRows = await this.databaseService.db
      .select({
        userId: userRoles.userId,
        roleCode: roles.code,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id));

    return userRows.map((user) => ({
      id: user.id,
      email: user.email,
      phone: user.phone,
      telegram: user.telegram,
      isActive: user.isActive,
      roles: roleRows
        .filter((row) => row.userId === user.id)
        .map((row) => row.roleCode),
      createdAt: user.createdAt,
    }));
  }

  async updateRoles(userId: string, nextRoles: string[]) {
    const uniqueRoles = [...new Set(nextRoles)];
    const validRoleCodes = new Set(APP_ROLES.map((role) => role.code));

    if (uniqueRoles.some((role) => !validRoleCodes.has(role as never))) {
      throw new ConflictException({
        code: 'invalid_role_code',
        message: 'Vai trò được chọn không hợp lệ.',
      });
    }

    const [user] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new NotFoundException({
        code: 'user_not_found',
        message: 'Không tìm thấy người dùng.',
      });
    }

    const roleEntities = await this.databaseService.db
      .select()
      .from(roles)
      .where(inArray(roles.code, uniqueRoles));

    await this.databaseService.db
      .delete(userRoles)
      .where(eq(userRoles.userId, userId));

    if (roleEntities.length > 0) {
      await this.databaseService.db.insert(userRoles).values(
        roleEntities.map((role) => ({
          roleId: role.id,
          userId,
        })),
      );
    }

    return this.getProfile(userId);
  }

  async listForAdmin(query: AdminUserListQueryDto) {
    const search = normalizeAdminUserSearch(query.search);
    const userRows = search
      ? await this.databaseService.db
          .select()
          .from(users)
          .where(
            sql`
              lower(${users.email}) like ${`%${search}%`}
              or lower(${users.id}) like ${`%${search}%`}
              or lower(coalesce(${users.phone}, '')) like ${`%${search}%`}
            `,
          )
          .orderBy(desc(users.createdAt))
      : await this.databaseService.db
          .select()
          .from(users)
          .orderBy(desc(users.createdAt));

    if (userRows.length === 0) {
      return [];
    }

    const userIds = userRows.map((user) => user.id);
    const [roleRows, walletRows, depositTotals, withdrawalTotals] =
      await Promise.all([
        this.getRoleRows(userIds),
        this.getWalletRows(userIds),
        this.getApprovedDepositTotals(userIds),
        this.getApprovedWithdrawalTotals(userIds),
      ]);

    return userRows
      .filter((user) =>
        matchesAdminUserSearch(
          {
            userEmail: user.email,
            userId: user.id,
            userPhone: user.phone,
          },
          search,
        ),
      )
      .map((user) =>
      this.toAdminUserSummary(
        user,
        roleRows,
        walletRows,
        depositTotals,
        withdrawalTotals,
      ),
      );
  }

  async listRoleOptions() {
    const roleRows = await this.databaseService.db
      .select({
        code: roles.code,
        id: roles.id,
        name: roles.name,
      })
      .from(roles)
      .orderBy(roles.createdAt);

    if (roleRows.length > 0) {
      return roleRows;
    }

    return APP_ROLES.map((role, index) => ({
      code: role.code,
      id: String(index + 1),
      name: role.name,
    }));
  }

  async updateProfileByAdmin(
    actorUserId: string,
    targetUserId: string,
    dto: UpdateAdminUserProfileDto,
  ) {
    const user = await this.getExistingUser(targetUserId);
    const normalizedEmail =
      dto.email === undefined ? undefined : this.normalizeEmail(dto.email);

    if (normalizedEmail && normalizedEmail !== user.email) {
      const [duplicate] = await this.databaseService.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (duplicate) {
        throw new ConflictException({
          code: 'email_already_exists',
          message: 'Email này đã được sử dụng.',
        });
      }
    }

    await this.databaseService.db
      .update(users)
      .set({
        email: normalizedEmail ?? user.email,
        phone: dto.phone === undefined ? user.phone : dto.phone || null,
        telegram:
          dto.telegram === undefined
            ? normalizeTelegramUsernameForRead(user.telegram)
            : normalizeTelegramUsername(dto.telegram),
      })
      .where(eq(users.id, targetUserId));

    await this.auditService.log({
      actorUserId,
      action: 'admin-user.profile-updated',
      entityType: 'user',
      entityId: targetUserId,
      metadata: {
        email: normalizedEmail ?? user.email,
      },
    });

    return this.getAdminUserById(targetUserId);
  }

  async updateRolesByAdmin(
    actorUserId: string,
    actorRoles: string[],
    targetUserId: string,
    dto: UpdateAdminUserRolesDto,
  ) {
    if (!actorRoles.includes(ROLE_SUPER_ADMIN)) {
      throw new ForbiddenException({
        code: 'super_admin_required',
        message: 'Chỉ super admin mới được phép thay đổi phân quyền.',
      });
    }

    const nextRoles = [...new Set(dto.roles.map((role) => role.trim()))];
    const validRoleCodes = new Set(APP_ROLES.map((role) => role.code));

    if (nextRoles.some((role) => !validRoleCodes.has(role as never))) {
      throw new ConflictException({
        code: 'invalid_role_code',
        message: 'Vai trò được chọn không hợp lệ.',
      });
    }

    await this.getExistingUser(targetUserId);

    const roleEntities = await this.databaseService.db
      .select()
      .from(roles)
      .where(inArray(roles.code, nextRoles));

    if (roleEntities.length !== nextRoles.length) {
      throw new ConflictException({
        code: 'invalid_role_code',
        message: 'Vai trò được chọn không hợp lệ.',
      });
    }

    await this.databaseService.db
      .delete(userRoles)
      .where(eq(userRoles.userId, targetUserId));

    await this.databaseService.db.insert(userRoles).values(
      roleEntities.map((role) => ({
        roleId: role.id,
        userId: targetUserId,
      })),
    );

    await this.auditService.log({
      actorUserId,
      action: 'admin-user.roles-updated',
      entityType: 'user',
      entityId: targetUserId,
      metadata: {
        roles: nextRoles,
      },
    });

    return this.getAdminUserById(targetUserId);
  }

  async setPasswordByAdmin(
    actorUserId: string,
    targetUserId: string,
    dto: UpdateAdminUserPasswordDto,
  ) {
    await this.getExistingUser(targetUserId);

    const passwordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });

    await this.databaseService.db
      .update(users)
      .set({
        passwordHash,
      })
      .where(eq(users.id, targetUserId));

    await this.auditService.log({
      actorUserId,
      action: 'admin-user.password-updated',
      entityType: 'user',
      entityId: targetUserId,
      metadata: null,
    });

    return {
      success: true,
    };
  }

  async overwriteBalancesByAdmin(
    actorUserId: string,
    targetUserId: string,
    dto: OverwriteAdminUserBalancesDto,
  ) {
    if (dto.vnd === undefined && dto.usdt === undefined) {
      throw new BadRequestException({
        code: 'admin_balance_input_required',
        message: 'Cần nhập ít nhất một số dư để cập nhật.',
      });
    }

    const assetEntities = await this.assetsService.findByCodes(['VND', 'USDT']);
    const assetByCode = new Map(
      assetEntities.map((asset) => [asset.code, asset]),
    );

    const vndAsset = assetByCode.get('VND');
    const usdtAsset = assetByCode.get('USDT');

    if (!vndAsset || !usdtAsset) {
      throw new NotFoundException({
        code: 'required_assets_missing',
        message: 'Không tìm thấy tài sản bắt buộc trong hệ thống.',
      });
    }

    await this.getExistingUser(targetUserId);
    await this.walletsService.ensureWalletsForUser(targetUserId, [
      vndAsset.id,
      usdtAsset.id,
    ]);

    const adjustmentReferenceId = randomUUID();

    await this.databaseService.db.transaction(async (tx) => {
      if (dto.vnd !== undefined) {
        await this.adjustWalletAvailableBalance({
          adjustmentReferenceId,
          assetId: vndAsset.id,
          notePrefix: 'Admin cập nhật số dư VND',
          precision: vndAsset.assetPrecision,
          targetAmount: dto.vnd,
          targetUserId,
          tx,
        });
      }

      if (dto.usdt !== undefined) {
        await this.adjustWalletAvailableBalance({
          adjustmentReferenceId,
          assetId: usdtAsset.id,
          notePrefix: 'Admin cập nhật số dư USDT',
          precision: usdtAsset.assetPrecision,
          targetAmount: dto.usdt,
          targetUserId,
          tx,
        });
      }

      await this.auditService.logWithTransaction(tx, {
        actorUserId,
        action: 'admin-user.balances-overwritten',
        entityType: 'user',
        entityId: targetUserId,
        metadata: {
          usdt: dto.usdt,
          vnd: dto.vnd,
        },
      });
    });

    return this.getAdminUserById(targetUserId);
  }

  async addBalanceByAdmin(
    actorUserId: string,
    targetUserId: string,
    dto: AddAdminUserBalanceDto,
  ) {
    const asset = await this.assetsService.findByCode(dto.assetCode);

    if (!asset) {
      throw new NotFoundException({
        code: 'asset_not_found',
        message: 'Không tìm thấy tài sản.',
      });
    }

    await this.getExistingUser(targetUserId);
    await this.walletsService.ensureWalletsForUser(targetUserId, [asset.id]);

    const amountMinor = parsePositiveAmountToMinorUnits(
      dto.amount,
      asset.assetPrecision,
    );
    const referenceId = randomUUID();

    await this.databaseService.db.transaction(async (tx) => {
      const wallet = await this.walletsService.getWalletByUserAndAssetId(
        targetUserId,
        asset.id,
      );
      const lockedWallet = await this.ledgerService.lockWallet(tx, wallet.id);

      await this.ledgerService.creditAvailableAndTotal(
        tx,
        lockedWallet.id,
        amountMinor,
        'admin_adjust',
        referenceId,
        `Admin cộng ${dto.amount} ${dto.assetCode}`,
        undefined,
        lockedWallet,
      );

      await this.auditService.logWithTransaction(tx, {
        actorUserId,
        action: 'admin-user.balance-added',
        entityType: 'user',
        entityId: targetUserId,
        metadata: {
          amount: dto.amount,
          assetCode: dto.assetCode,
        },
      });
    });

    return this.getAdminUserById(targetUserId);
  }

  private async getExistingUser(userId: string) {
    const [user] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException({
        code: 'user_not_found',
        message: 'Không tìm thấy người dùng.',
      });
    }

    return user;
  }

  private normalizeEmail(email: string) {
    const normalized = email.trim().toLowerCase();

    if (!normalized) {
      throw new BadRequestException({
        code: 'email_required',
        message: 'Email không được để trống.',
      });
    }

    return normalized;
  }

  private async getAdminUserById(userId: string) {
    const usersForAdmin = await this.listForAdmin({});
    const user = usersForAdmin.find((item) => item.id === userId);

    if (!user) {
      throw new NotFoundException({
        code: 'user_not_found',
        message: 'Không tìm thấy người dùng.',
      });
    }

    return user;
  }

  private async getRoleRows(userIds: string[]) {
    return userIds.length === 0
      ? []
      : this.databaseService.db
          .select({
            roleCode: roles.code,
            userId: userRoles.userId,
          })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(inArray(userRoles.userId, userIds));
  }

  private async getWalletRows(userIds: string[]) {
    return userIds.length === 0
      ? []
      : this.databaseService.db
          .select({
            assetCode: assets.code,
            availableMinor: wallets.availableMinor,
            pendingMinor: wallets.pendingMinor,
            precision: assets.assetPrecision,
            totalMinor: wallets.totalMinor,
            userId: wallets.userId,
          })
          .from(wallets)
          .innerJoin(assets, eq(wallets.assetId, assets.id))
          .where(inArray(wallets.userId, userIds));
  }

  private async getApprovedDepositTotals(userIds: string[]) {
    return userIds.length === 0
      ? []
      : this.databaseService.db
          .select({
            amountMinor: depositRequests.amountMinor,
            assetCode: assets.code,
            precision: assets.assetPrecision,
            userId: depositRequests.userId,
          })
          .from(depositRequests)
          .innerJoin(assets, eq(depositRequests.assetId, assets.id))
          .where(
            and(
              eq(depositRequests.status, 'approved'),
              inArray(depositRequests.userId, userIds),
            ),
          );
  }

  private async getApprovedWithdrawalTotals(userIds: string[]) {
    return userIds.length === 0
      ? []
      : this.databaseService.db
          .select({
            amountMinor: withdrawalRequests.totalDebitMinor,
            assetCode: assets.code,
            precision: assets.assetPrecision,
            userId: withdrawalRequests.userId,
          })
          .from(withdrawalRequests)
          .innerJoin(assets, eq(withdrawalRequests.assetId, assets.id))
          .where(
            and(
              eq(withdrawalRequests.status, 'approved'),
              inArray(withdrawalRequests.userId, userIds),
            ),
          );
  }

  private toAdminUserSummary(
    user: typeof users.$inferSelect,
    roleRows: Array<{ roleCode: string; userId: string }>,
    walletRows: AssetWalletRow[],
    depositTotals: Array<{
      amountMinor: bigint;
      assetCode: string;
      precision: number;
      userId: string;
    }>,
    withdrawalTotals: Array<{
      amountMinor: bigint;
      assetCode: string;
      precision: number;
      userId: string;
    }>,
  ): AdminUserSummary {
    return buildAdminUserSummary({
      depositTotals,
      roleRows,
      user,
      walletRows,
      withdrawalTotals,
    });
  }

  private parseNonNegativeAmount(amount: string, precision: number) {
    let minorUnits: bigint;

    try {
      minorUnits = toMinorUnits(amount, precision);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === TOO_MANY_DECIMAL_PLACES_MESSAGE
      ) {
        throw new BadRequestException(error.message);
      }

      throw new BadRequestException(INVALID_AMOUNT_MESSAGE);
    }

    if (minorUnits < 0n) {
      throw new BadRequestException(NON_NEGATIVE_AMOUNT_MESSAGE);
    }

    return minorUnits;
  }

  private async adjustWalletAvailableBalance(input: {
    adjustmentReferenceId: string;
    assetId: string;
    notePrefix: string;
    precision: number;
    targetAmount: string;
    targetUserId: string;
    tx: AppTransaction;
  }) {
    const wallet = await this.walletsService.getWalletByUserAndAssetId(
      input.targetUserId,
      input.assetId,
    );
    const lockedWallet = await this.ledgerService.lockWallet(
      input.tx,
      wallet.id,
    );
    const nextAvailableMinor = this.parseNonNegativeAmount(
      input.targetAmount,
      input.precision,
    );

    if (nextAvailableMinor === lockedWallet.availableMinor) {
      return;
    }

    const deltaMinor =
      nextAvailableMinor > lockedWallet.availableMinor
        ? nextAvailableMinor - lockedWallet.availableMinor
        : lockedWallet.availableMinor - nextAvailableMinor;

    const note = `${input.notePrefix}: ${input.targetAmount}`;

    if (nextAvailableMinor > lockedWallet.availableMinor) {
      await this.ledgerService.creditAvailableAndTotal(
        input.tx,
        lockedWallet.id,
        deltaMinor,
        'admin_adjust',
        input.adjustmentReferenceId,
        note,
        undefined,
        lockedWallet,
      );
      return;
    }

    await this.ledgerService.debitAvailableAndTotal(
      input.tx,
      lockedWallet.id,
      deltaMinor,
      'admin_adjust',
      input.adjustmentReferenceId,
      note,
      undefined,
      lockedWallet,
    );
  }
}
