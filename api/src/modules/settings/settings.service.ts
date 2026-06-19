import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { imageSize } from 'image-size';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../../platform/database/database.service';
import type { AppTransaction } from '../../platform/database/database.types';
import { settings } from '../../platform/database/schema';

const DEPOSIT_RESERVATION_TTL_KEY = 'deposit_reservation_ttl_minutes';
const DEFAULT_DEPOSIT_RESERVATION_TTL_MINUTES = 15;
const EXCHANGE_VND_TO_USDT_MARKUP_VND_KEY = 'exchange_vnd_to_usdt_markup_vnd';
const EXCHANGE_USDT_TO_VND_MARKUP_VND_KEY = 'exchange_usdt_to_vnd_markup_vnd';
const EXCHANGE_VND_TO_USDT_FEE_BPS_KEY = 'exchange_vnd_to_usdt_trade_fee_bps';
const EXCHANGE_USDT_TO_VND_FEE_BPS_KEY = 'exchange_usdt_to_vnd_trade_fee_bps';
const LEGACY_EXCHANGE_VND_TO_USDT_FEE_BPS_KEY = 'exchange_vnd_to_usdt_fee_bps';
const DEFAULT_EXCHANGE_VND_TO_USDT_MARKUP_VND = 1000;
const DEFAULT_EXCHANGE_USDT_TO_VND_MARKUP_VND = 700;
const DEFAULT_EXCHANGE_VND_TO_USDT_FEE_BPS = 100;
const DEFAULT_EXCHANGE_USDT_TO_VND_FEE_BPS = 50;
const SUPPORT_LINK_KEY = 'support_link';
const DEFAULT_SUPPORT_LINK = 'https://t.me/nganluong_support';
const HOMEPAGE_BANNERS_KEY = 'homepage_banners';
const LEGACY_DEPOSIT_USDT_WALLET_ADDRESS_KEY = 'deposit_usdt_wallet_address';
const WITHDRAWAL_VND_FEE_BPS_KEY = 'withdrawal_vnd_fee_bps';
const DEFAULT_WITHDRAWAL_VND_FEE_BPS = 1000;
const WITHDRAWAL_USDT_FEE_BPS_KEY = 'withdrawal_usdt_fee_bps';
const DEFAULT_WITHDRAWAL_USDT_FEE_BPS = 0;
const DEFAULT_BANNER_UPLOAD_DIR = 'storage/homepage-banners';
const HOMEPAGE_BANNER_RATIO = 16 / 5;
const HOMEPAGE_BANNER_RATIO_TOLERANCE = 0.02;
const HOMEPAGE_BANNER_MAX_COUNT = 5;
const HOMEPAGE_BANNER_MAX_BYTES = 5 * 1024 * 1024;
const HOMEPAGE_BANNER_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type HomepageBannerRecord = {
  filename: string;
  height: number;
  id: string;
  sortOrder: number;
  width: number;
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  async getAdminSettings() {
    return {
      depositReservationTtlMinutes:
        await this.getDepositReservationTtlMinutes(),
      exchangeUsdtToVndFeeBps: await this.getExchangeUsdtToVndFeeBps(),
      exchangeUsdtToVndMarkupVnd: await this.getExchangeUsdtToVndMarkupVnd(),
      exchangeVndToUsdtFeeBps: await this.getExchangeVndToUsdtFeeBps(),
      exchangeVndToUsdtMarkupVnd: await this.getExchangeVndToUsdtMarkupVnd(),
      homepageBanners: await this.getHomepageBanners(),
      supportLink: await this.getSupportLink(),
      withdrawalUsdtFeeBps: await this.getWithdrawalFeeBps('USDT'),
      withdrawalVndFeeBps: await this.getWithdrawalFeeBps('VND'),
    };
  }

  async getFinancialSettings() {
    return {
      exchangeUsdtToVndFeeBps: await this.getExchangeUsdtToVndFeeBps(),
      exchangeUsdtToVndMarkupVnd: await this.getExchangeUsdtToVndMarkupVnd(),
      exchangeVndToUsdtFeeBps: await this.getExchangeVndToUsdtFeeBps(),
      exchangeVndToUsdtMarkupVnd: await this.getExchangeVndToUsdtMarkupVnd(),
      withdrawalUsdtFeeBps: await this.getWithdrawalFeeBps('USDT'),
      withdrawalVndFeeBps: await this.getWithdrawalFeeBps('VND'),
    };
  }

  async getDisplaySettings() {
    return {
      homepageBanners: await this.getHomepageBanners(),
      supportLink: await this.getSupportLink(),
    };
  }

  async updateAdminSettings(
    adminUserId: string,
    input: {
      depositReservationTtlMinutes: number;
      exchangeUsdtToVndFeeBps: number;
      exchangeUsdtToVndMarkupVnd: number;
      exchangeVndToUsdtFeeBps: number;
      exchangeVndToUsdtMarkupVnd: number;
      supportLink: string;
      withdrawalUsdtFeeBps: number;
      withdrawalVndFeeBps: number;
    },
  ) {
    const ttl = this.validateTtl(input.depositReservationTtlMinutes);
    const exchangeUsdtToVndFeeBps = this.validateFeeBps(
      input.exchangeUsdtToVndFeeBps,
    );
    const exchangeUsdtToVndMarkupVnd = this.validateMarkupVnd(
      input.exchangeUsdtToVndMarkupVnd,
    );
    const exchangeVndToUsdtFeeBps = this.validateFeeBps(
      input.exchangeVndToUsdtFeeBps,
    );
    const exchangeVndToUsdtMarkupVnd = this.validateMarkupVnd(
      input.exchangeVndToUsdtMarkupVnd,
    );
    const supportLink = this.validateDisplaySetting(
      input.supportLink,
      'Link hỗ trợ không được để trống.',
    );
    const withdrawalVndFeeBps = this.validateFeeBps(input.withdrawalVndFeeBps);
    const withdrawalUsdtFeeBps = this.validateFeeBps(
      input.withdrawalUsdtFeeBps,
    );

    await this.databaseService.db.transaction(async (tx) => {
      await this.upsertSettingInTransaction(
        tx,
        DEPOSIT_RESERVATION_TTL_KEY,
        String(ttl),
      );
      await this.upsertSettingInTransaction(
        tx,
        EXCHANGE_VND_TO_USDT_MARKUP_VND_KEY,
        String(exchangeVndToUsdtMarkupVnd),
      );
      await this.upsertSettingInTransaction(
        tx,
        EXCHANGE_USDT_TO_VND_MARKUP_VND_KEY,
        String(exchangeUsdtToVndMarkupVnd),
      );
      await this.upsertSettingInTransaction(
        tx,
        EXCHANGE_VND_TO_USDT_FEE_BPS_KEY,
        String(exchangeVndToUsdtFeeBps),
      );
      await this.upsertSettingInTransaction(
        tx,
        EXCHANGE_USDT_TO_VND_FEE_BPS_KEY,
        String(exchangeUsdtToVndFeeBps),
      );
      await this.upsertSettingInTransaction(tx, SUPPORT_LINK_KEY, supportLink);
      await tx
        .delete(settings)
        .where(eq(settings.key, LEGACY_DEPOSIT_USDT_WALLET_ADDRESS_KEY));
      await this.upsertSettingInTransaction(
        tx,
        WITHDRAWAL_VND_FEE_BPS_KEY,
        String(withdrawalVndFeeBps),
      );
      await this.upsertSettingInTransaction(
        tx,
        WITHDRAWAL_USDT_FEE_BPS_KEY,
        String(withdrawalUsdtFeeBps),
      );

      await this.auditService.logWithTransaction(tx, {
        actorUserId: adminUserId,
        action: 'settings.updated',
        entityType: 'setting',
        entityId: DEPOSIT_RESERVATION_TTL_KEY,
        metadata: {
          depositReservationTtlMinutes: ttl,
          exchangeUsdtToVndFeeBps,
          exchangeUsdtToVndMarkupVnd,
          exchangeVndToUsdtFeeBps,
          exchangeVndToUsdtMarkupVnd,
          supportLink,
          withdrawalUsdtFeeBps,
          withdrawalVndFeeBps,
        },
      });
    });

    return {
      depositReservationTtlMinutes: ttl,
      exchangeUsdtToVndFeeBps,
      exchangeUsdtToVndMarkupVnd,
      exchangeVndToUsdtFeeBps,
      exchangeVndToUsdtMarkupVnd,
      homepageBanners: await this.getHomepageBanners(),
      supportLink,
      withdrawalUsdtFeeBps,
      withdrawalVndFeeBps,
    };
  }

  async uploadHomepageBanner(
    adminUserId: string,
    file?: {
      buffer: Buffer;
      mimetype: string;
      originalname?: string;
      size: number;
    },
  ) {
    const normalizedFile = this.validateHomepageBannerFile(file);
    const currentBanners = await this.getHomepageBannerRecords();

    if (currentBanners.length >= HOMEPAGE_BANNER_MAX_COUNT) {
      throw new BadRequestException({
        code: 'homepage_banner_limit_reached',
        message: `Chỉ được cấu hình tối đa ${HOMEPAGE_BANNER_MAX_COUNT} banner trang chủ.`,
      });
    }

    const { height, width } = this.getHomepageBannerDimensions(
      normalizedFile.buffer,
    );
    const extension = this.getHomepageBannerExtension(normalizedFile.mimetype);
    const storedFilename = `${randomUUID()}.${extension}`;
    const storedFilePath = resolve(this.getHomepageBannerUploadDir(), storedFilename);
    const nextRecord: HomepageBannerRecord = {
      filename: storedFilename,
      height,
      id: randomUUID(),
      sortOrder: currentBanners.length,
      width,
    };

    await mkdir(this.getHomepageBannerUploadDir(), { recursive: true });
    await writeFile(storedFilePath, normalizedFile.buffer);

    try {
      await this.databaseService.db.transaction(async (tx) => {
        const nextBanners = [...currentBanners, nextRecord];
        await this.upsertSettingInTransaction(
          tx,
          HOMEPAGE_BANNERS_KEY,
          JSON.stringify(nextBanners),
        );
        await this.auditService.logWithTransaction(tx, {
          actorUserId: adminUserId,
          action: 'settings.homepage_banner_uploaded',
          entityId: nextRecord.id,
          entityType: 'setting',
          metadata: {
            filename: nextRecord.filename,
            height: nextRecord.height,
            sortOrder: nextRecord.sortOrder,
            width: nextRecord.width,
          },
        });
      });
    } catch (error) {
      await unlink(storedFilePath).catch(() => undefined);
      throw error;
    }

    return this.toHomepageBanner(nextRecord);
  }

  async reorderHomepageBanners(adminUserId: string, bannerIds: string[]) {
    const currentBanners = await this.getHomepageBannerRecords();

    if (
      bannerIds.length !== currentBanners.length ||
      new Set(bannerIds).size !== currentBanners.length
    ) {
      throw new BadRequestException({
        code: 'invalid_homepage_banner_order',
        message: 'Danh sách banner sắp xếp không hợp lệ.',
      });
    }

    const bannerById = new Map(currentBanners.map((banner) => [banner.id, banner]));
    const reordered = bannerIds.map((bannerId, index) => {
      const banner = bannerById.get(bannerId);

      if (!banner) {
        throw new BadRequestException({
          code: 'invalid_homepage_banner_order',
          message: 'Danh sách banner sắp xếp không hợp lệ.',
        });
      }

      return {
        ...banner,
        sortOrder: index,
      };
    });

    await this.databaseService.db.transaction(async (tx) => {
      await this.upsertSettingInTransaction(
        tx,
        HOMEPAGE_BANNERS_KEY,
        JSON.stringify(reordered),
      );
      await this.auditService.logWithTransaction(tx, {
        actorUserId: adminUserId,
        action: 'settings.homepage_banners_reordered',
        entityId: HOMEPAGE_BANNERS_KEY,
        entityType: 'setting',
        metadata: {
          bannerIds,
        },
      });
    });

    return reordered.map((banner) => this.toHomepageBanner(banner));
  }

  async deleteHomepageBanner(adminUserId: string, bannerId: string) {
    const currentBanners = await this.getHomepageBannerRecords();
    const bannerToDelete = currentBanners.find((banner) => banner.id === bannerId);

    if (!bannerToDelete) {
      throw new NotFoundException({
        code: 'homepage_banner_not_found',
        message: 'Không tìm thấy banner trang chủ.',
      });
    }

    const remainingBanners = currentBanners
      .filter((banner) => banner.id !== bannerId)
      .map((banner, index) => ({
        ...banner,
        sortOrder: index,
      }));

    await this.databaseService.db.transaction(async (tx) => {
      await this.upsertSettingInTransaction(
        tx,
        HOMEPAGE_BANNERS_KEY,
        JSON.stringify(remainingBanners),
      );
      await this.auditService.logWithTransaction(tx, {
        actorUserId: adminUserId,
        action: 'settings.homepage_banner_deleted',
        entityId: bannerId,
        entityType: 'setting',
        metadata: {
          filename: bannerToDelete.filename,
        },
      });
    });

    await unlink(resolve(this.getHomepageBannerUploadDir(), bannerToDelete.filename)).catch(
      () => undefined,
    );

    return {
      success: true,
    };
  }

  async getHomepageBannerFilePath(filename: string) {
    const normalizedFilename = basename(filename);

    if (!normalizedFilename || normalizedFilename !== filename) {
      throw new NotFoundException({
        code: 'homepage_banner_not_found',
        message: 'Không tìm thấy banner trang chủ.',
      });
    }

    const filePath = resolve(this.getHomepageBannerUploadDir(), normalizedFilename);
    await access(filePath).catch(() => {
      throw new NotFoundException({
        code: 'homepage_banner_not_found',
        message: 'Không tìm thấy banner trang chủ.',
      });
    });

    return filePath;
  }

  async getDepositReservationTtlMinutes(tx?: AppTransaction) {
    return this.getIntegerSetting(
      DEPOSIT_RESERVATION_TTL_KEY,
      DEFAULT_DEPOSIT_RESERVATION_TTL_MINUTES,
      tx,
    );
  }

  async getExchangeVndToUsdtMarkupVnd(tx?: AppTransaction) {
    const markup = await this.getIntegerSetting(
      EXCHANGE_VND_TO_USDT_MARKUP_VND_KEY,
      NaN,
      tx,
    );

    if (Number.isFinite(markup)) {
      return markup;
    }

    return this.getIntegerSetting(
      LEGACY_EXCHANGE_VND_TO_USDT_FEE_BPS_KEY,
      DEFAULT_EXCHANGE_VND_TO_USDT_MARKUP_VND,
      tx,
    );
  }

  async getExchangeUsdtToVndMarkupVnd(tx?: AppTransaction) {
    return this.getIntegerSetting(
      EXCHANGE_USDT_TO_VND_MARKUP_VND_KEY,
      DEFAULT_EXCHANGE_USDT_TO_VND_MARKUP_VND,
      tx,
    );
  }

  async getExchangeVndToUsdtFeeBps(tx?: AppTransaction) {
    return this.getIntegerSetting(
      EXCHANGE_VND_TO_USDT_FEE_BPS_KEY,
      DEFAULT_EXCHANGE_VND_TO_USDT_FEE_BPS,
      tx,
    );
  }

  async getExchangeUsdtToVndFeeBps(tx?: AppTransaction) {
    return this.getIntegerSetting(
      EXCHANGE_USDT_TO_VND_FEE_BPS_KEY,
      DEFAULT_EXCHANGE_USDT_TO_VND_FEE_BPS,
      tx,
    );
  }

  async getSupportLink(tx?: AppTransaction) {
    return this.getStringSetting(SUPPORT_LINK_KEY, DEFAULT_SUPPORT_LINK, tx);
  }

  async getHomepageBanners(tx?: AppTransaction) {
    const homepageBanners = await this.getHomepageBannerRecords(tx);
    return homepageBanners.map((banner) => this.toHomepageBanner(banner));
  }

  async getWithdrawalFeeBps(assetCode: 'USDT' | 'VND', tx?: AppTransaction) {
    return this.getIntegerSetting(
      assetCode === 'VND'
        ? WITHDRAWAL_VND_FEE_BPS_KEY
        : WITHDRAWAL_USDT_FEE_BPS_KEY,
      assetCode === 'VND'
        ? DEFAULT_WITHDRAWAL_VND_FEE_BPS
        : DEFAULT_WITHDRAWAL_USDT_FEE_BPS,
      tx,
    );
  }

  private validateTtl(value: number) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException({
        code: 'invalid_setting',
        message: 'Thời gian giữ chỗ phải là số nguyên dương.',
      });
    }

    return value;
  }

  private validateFeeBps(value: number) {
    if (!Number.isInteger(value) || value < 0 || value > 10000) {
      throw new BadRequestException({
        code: 'invalid_setting',
        message: 'Phí phần trăm phải là số nguyên từ 0 đến 10000 bps.',
      });
    }

    return value;
  }

  private validateMarkupVnd(value: number) {
    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException({
        code: 'invalid_setting',
        message: 'Markup tỷ giá phải là số nguyên VND không âm.',
      });
    }

    return value;
  }

  private validateDisplaySetting(value: string, message: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException({
        code: 'invalid_setting',
        message,
      });
    }

    return normalized;
  }

  private validateHomepageBannerFile(
    file?: {
      buffer: Buffer;
      mimetype: string;
      size: number;
    },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'invalid_banner_image',
        message: 'Vui lòng chọn ảnh banner hợp lệ.',
      });
    }

    if (
      file.size <= 0 ||
      file.size > HOMEPAGE_BANNER_MAX_BYTES ||
      !HOMEPAGE_BANNER_ALLOWED_MIME_TYPES.has(file.mimetype)
    ) {
      throw new BadRequestException({
        code: 'invalid_banner_image',
        message:
          'Ảnh banner phải là JPEG, PNG hoặc WEBP và không vượt quá 5MB.',
      });
    }

    return file;
  }

  private getHomepageBannerDimensions(buffer: Buffer) {
    const dimensions = imageSize(buffer);
    const width = dimensions.width ?? 0;
    const height = dimensions.height ?? 0;
    const ratio = height > 0 ? width / height : 0;
    const delta = Math.abs(ratio - HOMEPAGE_BANNER_RATIO) / HOMEPAGE_BANNER_RATIO;

    if (
      width <= 0 ||
      height <= 0 ||
      !Number.isFinite(delta) ||
      delta > HOMEPAGE_BANNER_RATIO_TOLERANCE
    ) {
      throw new BadRequestException({
        code: 'invalid_banner_image',
        message: 'Ảnh banner phải đúng tỷ lệ 16:5.',
      });
    }

    return {
      height,
      width,
    };
  }

  private getHomepageBannerExtension(mimetype: string) {
    switch (mimetype) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      default:
        throw new BadRequestException({
          code: 'invalid_banner_image',
          message:
            'Ảnh banner phải là JPEG, PNG hoặc WEBP và không vượt quá 5MB.',
        });
    }
  }

  private getHomepageBannerUploadDir() {
    return this.configService.get<string>(
      'BANNER_UPLOAD_DIR',
      DEFAULT_BANNER_UPLOAD_DIR,
    );
  }

  private toHomepageBanner(banner: HomepageBannerRecord) {
    return {
      height: banner.height,
      id: banner.id,
      imageUrl: `/api/v1/public/homepage-banners/${banner.filename}`,
      sortOrder: banner.sortOrder,
      width: banner.width,
    };
  }

  private async getHomepageBannerRecords(tx?: AppTransaction) {
    const rawValue = await this.getStringSetting(HOMEPAGE_BANNERS_KEY, '[]', tx);
    let parsedValue: unknown = [];

    try {
      parsedValue = JSON.parse(rawValue);
    } catch {
      parsedValue = [];
    }

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter((item): item is HomepageBannerRecord => {
        return (
          typeof item === 'object' &&
          item !== null &&
          typeof item.filename === 'string' &&
          typeof item.height === 'number' &&
          typeof item.id === 'string' &&
          typeof item.sortOrder === 'number' &&
          typeof item.width === 'number'
        );
      })
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item, index) => ({
        ...item,
        sortOrder: index,
      }));
  }

  private async getIntegerSetting(
    key: string,
    fallback: number,
    tx?: AppTransaction,
  ) {
    const executor = tx ?? this.databaseService.db;
    const [row] = await executor
      .select({
        value: settings.value,
      })
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

    if (!row) {
      return fallback;
    }

    const parsed = Number(row.value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return fallback;
    }

    return parsed;
  }

  private async getStringSetting(
    key: string,
    fallback: string,
    tx?: AppTransaction,
  ) {
    const executor = tx ?? this.databaseService.db;
    const [row] = await executor
      .select({
        value: settings.value,
      })
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

    if (!row?.value) {
      return fallback;
    }

    const normalized = row.value.trim();

    if (!normalized) {
      return fallback;
    }

    return normalized;
  }

  private async upsertSettingInTransaction(
    tx: AppTransaction,
    key: string,
    value: string,
  ) {
    const [existing] = await tx
      .select({ key: settings.key })
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1)
      .for('update');

    if (existing) {
      await tx.update(settings).set({ value }).where(eq(settings.key, key));
      return;
    }

    await tx.insert(settings).values({
      key,
      value,
    });
  }
}
