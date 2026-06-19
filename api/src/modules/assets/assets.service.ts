import { Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../platform/database/database.service';
import { assets } from '../../platform/database/schema';

@Injectable()
export class AssetsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async ensureSeededAssets() {
    const db = this.databaseService.db;
    const existingAssets = await db.select().from(assets);
    const existingAssetsByCode = new Map(
      existingAssets.map((asset) => [asset.code, asset]),
    );
    const seeds = [
      { code: 'VND', name: 'Vietnamese Dong', kind: 'fiat', precision: 0 },
      { code: 'USDT', name: 'Tether USD', kind: 'crypto', precision: 2 },
    ] as const;

    for (const seed of seeds) {
      const existingAsset = existingAssetsByCode.get(seed.code);

      if (!existingAsset) {
        await db.insert(assets).values({
          id: randomUUID(),
          code: seed.code,
          name: seed.name,
          kind: seed.kind,
          assetPrecision: seed.precision,
        });
        continue;
      }

      if (existingAsset.assetPrecision !== seed.precision) {
        await db
          .update(assets)
          .set({ assetPrecision: seed.precision })
          .where(eq(assets.id, existingAsset.id));
      }
    }
  }

  async findByCode(code: string) {
    const [asset] = await this.databaseService.db
      .select()
      .from(assets)
      .where(eq(assets.code, code));

    return asset ?? null;
  }

  async findByCodes(codes: string[]) {
    return this.databaseService.db
      .select()
      .from(assets)
      .where(inArray(assets.code, codes));
  }

  async findById(id: string) {
    const [asset] = await this.databaseService.db
      .select()
      .from(assets)
      .where(eq(assets.id, id));

    return asset ?? null;
  }

  async listActiveAssets() {
    return this.databaseService.db.select().from(assets);
  }
}
