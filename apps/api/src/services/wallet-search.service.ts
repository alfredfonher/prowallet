import { loggerService } from "./logging";

interface WalletInfo {
  id: string;
  address: string;
  username: string;
  label: string;
}

class WalletSearchService {
  private cache: WalletInfo[] = [];
  private lastUpdate: number = 0;
  private readonly CACHE_TTL_MS = 5000; // 5 seconds
  private isUpdating: boolean = false;

  /**
   * Get all wallets with caching and auto-refresh
   */
  async getWallets(): Promise<WalletInfo[]> {
    const now = Date.now();

    // Return cached data if still valid
    if (
      !this.isUpdating &&
      now - this.lastUpdate < this.CACHE_TTL_MS &&
      this.cache.length > 0
    ) {
      return this.cache;
    }

    // Update cache if stale or empty
    return await this.refreshWallets();
  }

  /**
   * Force refresh the wallet cache
   */
  async refreshWallets(): Promise<WalletInfo[]> {
    if (this.isUpdating) {
      // If already updating, wait for current update
      return this.cache;
    }

    this.isUpdating = true;

    try {
      loggerService.logInfo("Refreshing wallet cache", {
        context: "WalletSearchService",
        cacheSize: this.cache.length,
        lastUpdate: new Date(this.lastUpdate).toISOString(),
      });

      const { PrismaClient } = require("@prisma/client");
      const prisma = new PrismaClient();

      const mvp_users = await prisma.user.findMany({
        where: {
          solanaPublicKey: {
            not: null,
          },
        },
        select: {
          id: true,
          username: true,
          solanaPublicKey: true,
        },
        orderBy: {
          username: "asc",
        },
      });

      const wallets: WalletInfo[] = mvp_users
        .map((user: any) => ({
          id: user.id,
          address: user.solanaPublicKey,
          label: user.username || user.solanaPublicKey,
          username: user.username || "",
        }))
        .filter((w: WalletInfo) => w.address)
        // Remove duplicates by address
        .filter(
          (wallet: WalletInfo, index: number, self: WalletInfo[]) =>
            index ===
            self.findIndex((w: WalletInfo) => w.address === wallet.address),
        );

      await prisma.$disconnect();

      this.cache = wallets;
      this.lastUpdate = Date.now();

      loggerService.logInfo("Wallet cache refreshed", {
        context: "WalletSearchService",
        walletCount: wallets.length,
        cacheSize: this.cache.length,
      });

      return wallets;
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "WalletSearchService",
        action: "refreshWallets",
      });

      // Return cached data even if stale
      return this.cache;
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Search wallets with smart ranking
   */
  async searchWallets(query: string, limit: number = 5): Promise<WalletInfo[]> {
    const wallets = await this.getWallets();

    if (!query.trim()) {
      return wallets.slice(0, limit);
    }

    const cleanQuery = query.toLowerCase().trim();

    // Rank wallets by relevance
    const ranked = wallets
      .map((wallet) => {
        let score = 0;

        // Exact address match gets highest score
        if (wallet.address.toLowerCase() === cleanQuery) {
          score = 100;
        }
        // Address starts with query
        else if (wallet.address.toLowerCase().startsWith(cleanQuery)) {
          score = 80;
        }
        // Exact username match
        else if (wallet.username.toLowerCase() === cleanQuery) {
          score = 90;
        }
        // Username starts with query
        else if (wallet.username.toLowerCase().startsWith(cleanQuery)) {
          score = 70;
        }
        // Address contains query
        else if (wallet.address.toLowerCase().includes(cleanQuery)) {
          score = 50;
        }
        // Username contains query
        else if (wallet.username.toLowerCase().includes(cleanQuery)) {
          score = 40;
        }

        return { wallet, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.wallet);

    return ranked;
  }

  /**
   * Check if wallet is registered
   */
  async isWalletRegistered(address: string): Promise<boolean> {
    const wallets = await this.getWallets();
    return wallets.some(
      (wallet) => wallet.address.toLowerCase() === address.toLowerCase(),
    );
  }

  /**
   * Get wallet info by address
   */
  async getWalletInfo(address: string): Promise<WalletInfo | null> {
    const wallets = await this.getWallets();
    return (
      wallets.find(
        (wallet) => wallet.address.toLowerCase() === address.toLowerCase(),
      ) || null
    );
  }

  /**
   * Get cache status
   */
  getCacheStatus() {
    return {
      lastUpdate: this.lastUpdate,
      cacheSize: this.cache.length,
      isUpdating: this.isUpdating,
      isStale: Date.now() - this.lastUpdate > this.CACHE_TTL_MS,
    };
  }
}

export const walletSearchService = new WalletSearchService();
