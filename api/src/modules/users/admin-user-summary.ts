import { fromMinorUnits } from '../../platform/money/amounts';

export type AssetWalletRow = {
  assetCode: string;
  precision: number;
  availableMinor: bigint;
  pendingMinor: bigint;
  totalMinor: bigint;
  userId: string;
};

export type AdminAmountRow = {
  amountMinor: bigint;
  assetCode: string;
  precision: number;
  userId: string;
};

export type AdminUserSummary = {
  balances: {
    usdt: {
      available: string;
      pending: string;
      total: string;
    };
    vnd: {
      available: string;
      pending: string;
      total: string;
    };
  };
  createdAt: string;
  email: string;
  id: string;
  phone: string | null;
  roles: string[];
  telegram: string | null;
  twoFactorEnabled: boolean;
  totals: {
    totalDepositUsdt: string;
    totalDepositVnd: string;
    totalWithdrawUsdt: string;
    totalWithdrawVnd: string;
  };
};

type BuildAdminUserSummaryInput = {
  depositTotals: AdminAmountRow[];
  roleRows: Array<{ roleCode: string; userId: string }>;
  user: {
    createdAt: Date;
    email: string;
    id: string;
    phone: string | null;
    telegram: string | null;
  };
  walletRows: AssetWalletRow[];
  withdrawalTotals: AdminAmountRow[];
};

export function sumAdminAssetAmounts(
  rows: AdminAmountRow[],
  userId: string,
  assetCode: 'USDT' | 'VND',
) {
  const userRows = rows.filter(
    (row) => row.userId === userId && row.assetCode === assetCode,
  );

  if (userRows.length === 0) {
    return assetCode === 'VND' ? '0' : '0.00';
  }

  const precision = userRows[0].precision;
  const totalMinor = userRows.reduce((sum, row) => sum + row.amountMinor, 0n);

  return fromMinorUnits(totalMinor, precision);
}

export function buildAdminUserSummary({
  depositTotals,
  roleRows,
  user,
  walletRows,
  withdrawalTotals,
}: BuildAdminUserSummaryInput): AdminUserSummary {
  const userWalletRows = walletRows.filter((row) => row.userId === user.id);
  const vndWallet = userWalletRows.find((row) => row.assetCode === 'VND');
  const usdtWallet = userWalletRows.find((row) => row.assetCode === 'USDT');

  return {
    balances: {
      usdt: {
        available: usdtWallet
          ? fromMinorUnits(usdtWallet.availableMinor, usdtWallet.precision)
          : '0.00',
        pending: usdtWallet
          ? fromMinorUnits(usdtWallet.pendingMinor, usdtWallet.precision)
          : '0.00',
        total: usdtWallet
          ? fromMinorUnits(usdtWallet.totalMinor, usdtWallet.precision)
          : '0.00',
      },
      vnd: {
        available: vndWallet
          ? fromMinorUnits(vndWallet.availableMinor, vndWallet.precision)
          : '0',
        pending: vndWallet
          ? fromMinorUnits(vndWallet.pendingMinor, vndWallet.precision)
          : '0',
        total: vndWallet
          ? fromMinorUnits(vndWallet.totalMinor, vndWallet.precision)
          : '0',
      },
    },
    createdAt: user.createdAt.toISOString(),
    email: user.email,
    id: user.id,
    phone: user.phone,
    roles: roleRows
      .filter((row) => row.userId === user.id)
      .map((row) => row.roleCode),
    telegram: user.telegram,
    twoFactorEnabled: false,
    totals: {
      totalDepositUsdt: sumAdminAssetAmounts(depositTotals, user.id, 'USDT'),
      totalDepositVnd: sumAdminAssetAmounts(depositTotals, user.id, 'VND'),
      totalWithdrawUsdt: sumAdminAssetAmounts(withdrawalTotals, user.id, 'USDT'),
      totalWithdrawVnd: sumAdminAssetAmounts(withdrawalTotals, user.id, 'VND'),
    },
  };
}
