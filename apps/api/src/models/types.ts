import { Prisma } from "@prisma/client";
import { databaseService } from "../services/database/database.service";

/**
 * Type for Transaction entity from Prisma
 */
export type Transaction = Prisma.TransactionGetPayload<{}>;

/**
 * Type for MetadataJob entity from Prisma
 */
export type MetadataJob = Prisma.MetadataJobGetPayload<{}>;

/**
 * Helper class for Transaction operations with Prisma
 */
export class TransactionRepository {
  private prisma = databaseService.getClient();

  /**
   * Create a new transaction
   */
  async create(data: Prisma.TransactionCreateInput): Promise<Transaction> {
    return this.prisma.transaction.create({
      data,
    });
  }

  /**
   * Find a transaction by ID
   */
  async findById(id: string): Promise<Transaction | null> {
    return this.prisma.transaction.findUnique({
      where: { id },
    });
  }

  /**
   * Find a transaction by transactionId
   */
  async findByTransactionId(
    transactionId: string,
  ): Promise<Transaction | null> {
    return this.prisma.transaction.findUnique({
      where: { transactionId },
    });
  }

  /**
   * Find transaction by signature
   */
  async findBySignature(signature: string): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({
      where: { signature },
    });
  }

  /**
   * Find one transaction
   */
  async findOne(
    where: Prisma.TransactionWhereInput,
  ): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({
      where,
    });
  }

  /**
   * Find transactions with filtering and pagination
   */
  async find(
    where: Prisma.TransactionWhereInput,
    options?: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.TransactionOrderByWithRelationInput;
    },
  ): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where,
      skip: options?.skip,
      take: options?.take,
      orderBy: options?.orderBy,
    });
  }

  /**
   * Update a transaction
   */
  async update(
    where: Prisma.TransactionWhereUniqueInput,
    data: Prisma.TransactionUpdateInput,
  ): Promise<Transaction> {
    return this.prisma.transaction.update({
      where,
      data,
    });
  }

  /**
   * Update transaction status
   */
  async updateStatus(
    transactionId: string,
    status: "pending" | "success" | "failed" | "cancelled",
  ): Promise<Transaction> {
    return this.prisma.transaction.update({
      where: { transactionId },
      data: { status },
    });
  }

  /**
   * Mark transaction as completed
   */
  async markAsCompleted(transactionId: string): Promise<Transaction> {
    return this.prisma.transaction.update({
      where: { transactionId },
      data: {
        status: "success",
        completedAt: new Date(),
      },
    });
  }

  /**
   * Mark transaction as failed
   */
  async markAsFailed(
    transactionId: string,
    error: string,
  ): Promise<Transaction> {
    return this.prisma.transaction.update({
      where: { transactionId },
      data: {
        status: "failed",
        error,
        completedAt: new Date(),
      },
    });
  }

  /**
   * Delete a transaction
   */
  async delete(
    where: Prisma.TransactionWhereUniqueInput,
  ): Promise<Transaction> {
    return this.prisma.transaction.delete({
      where,
    });
  }

  /**
   * Count transactions with filtering
   */
  async count(where?: Prisma.TransactionWhereInput): Promise<number> {
    return this.prisma.transaction.count({
      where,
    });
  }

  /**
   * Get volume stats
   */
  async getVolumeStats(timeframe?: string): Promise<any[]> {
    const where: Prisma.TransactionWhereInput = {
      status: "success",
    };

    if (timeframe) {
      const now = new Date();
      let startDate: Date;

      switch (timeframe) {
        case "1h":
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case "24h":
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      where.createdAt = { gte: startDate };
    }

    const transactions = await this.find(where);

    return [
      {
        totalVolume: transactions.reduce(
          (sum, tx) => sum + (tx.tokenAmount || 0),
          0,
        ),
        totalCount: transactions.length,
        averagePrice:
          transactions.length > 0
            ? transactions.reduce((sum, tx) => sum + (tx.tokenPrice || 0), 0) /
              transactions.length
            : 0,
      },
    ];
  }

  /**
   * Get holder stats
   */
  async getHolderStats(): Promise<any[]> {
    const transactions = await this.find(
      {
        status: "success",
        transactionType: "purchase",
      },
      {
        orderBy: { tokenAmount: "desc" },
        take: 100,
      },
    );

    const holders = new Map<string, number>();

    for (const tx of transactions) {
      const current = holders.get(tx.walletAddress) || 0;
      holders.set(tx.walletAddress, current + tx.tokenAmount);
    }

    return Array.from(holders.entries())
      .map(([address, amount]) => ({
        walletAddress: address,
        tokenAmount: amount,
      }))
      .sort((a, b) => b.tokenAmount - a.tokenAmount);
  }

  /**
   * Get price history
   */
  async getPriceHistory(timeframe?: string): Promise<any[]> {
    const where: Prisma.TransactionWhereInput = {
      status: "success",
    };

    if (timeframe) {
      const now = new Date();
      let startDate: Date;

      switch (timeframe) {
        case "1h":
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case "24h":
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      where.createdAt = { gte: startDate };
    }

    const transactions = await this.find(where, {
      orderBy: { createdAt: "asc" },
    });

    return transactions
      .filter((tx) => tx.tokenPrice)
      .map((tx) => ({
        timestamp: tx.createdAt,
        price: tx.tokenPrice,
      }));
  }

  /**
   * Expire pending transactions older than TTL
   */
  async expirePendingTransactions(
    ttlMs: number = 10 * 60 * 1000,
  ): Promise<number> {
    const cutoff = new Date(Date.now() - ttlMs);

    const result = await this.prisma.transaction.updateMany({
      where: {
        status: "pending",
        createdAt: { lte: cutoff },
      },
      data: {
        status: "failed",
        error: "Transaction expired",
        completedAt: new Date(),
      },
    });

    return result.count;
  }
}

/**
 * Helper class for MetadataJob operations with Prisma
 */
export class MetadataJobRepository {
  private prisma = databaseService.getClient();

  /**
   * Create a new metadata job
   */
  async create(data: Prisma.MetadataJobCreateInput): Promise<MetadataJob> {
    return this.prisma.metadataJob.create({
      data,
    });
  }

  /**
   * Find a metadata job by ID
   */
  async findById(id: string): Promise<MetadataJob | null> {
    return this.prisma.metadataJob.findUnique({
      where: { id },
    });
  }

  /**
   * Find metadata jobs
   */
  async find(
    where: Prisma.MetadataJobWhereInput,
    options?: {
      skip?: number;
      take?: number;
      orderBy?: Prisma.MetadataJobOrderByWithRelationInput;
    },
  ): Promise<MetadataJob[]> {
    return this.prisma.metadataJob.findMany({
      where,
      skip: options?.skip,
      take: options?.take,
      orderBy: options?.orderBy,
    });
  }

  /**
   * Update a metadata job
   */
  async update(
    where: Prisma.MetadataJobWhereUniqueInput,
    data: Prisma.MetadataJobUpdateInput,
  ): Promise<MetadataJob> {
    return this.prisma.metadataJob.update({
      where,
      data,
    });
  }

  /**
   * Delete a metadata job
   */
  async delete(
    where: Prisma.MetadataJobWhereUniqueInput,
  ): Promise<MetadataJob> {
    return this.prisma.metadataJob.delete({
      where,
    });
  }

  /**
   * Count metadata jobs
   */
  async count(where?: Prisma.MetadataJobWhereInput): Promise<number> {
    return this.prisma.metadataJob.count({
      where,
    });
  }
}

// Export singleton instances
export const transactionRepository = new TransactionRepository();
export const metadataJobRepository = new MetadataJobRepository();
