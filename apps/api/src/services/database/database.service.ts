import { PrismaClient } from "@prisma/client";
import { loggerService } from "../logging/logger.service";

export class DatabaseService {
  private static instance: DatabaseService;
  private prisma: PrismaClient;
  private isConnected: boolean = false;

  private constructor() {
    this.prisma = new PrismaClient();

    // Simple logging in development
    if (process.env.NODE_ENV === "development") {
      loggerService.logInfo("Database service initialized", {
        context: "DatabaseService",
      });
    }
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async connect(): Promise<void> {
    try {
      if (this.isConnected) {
        loggerService.logInfo("Database already connected");
        return;
      }

      // Test the connection
      await this.prisma.$queryRaw`SELECT 1`;

      this.isConnected = true;

      loggerService.logInfo("Database connected successfully", {
        database: "PostgreSQL",
        provider: "Prisma ORM",
      });
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "Failed to connect to database",
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (!this.isConnected) {
        return;
      }

      await this.prisma.$disconnect();
      this.isConnected = false;

      loggerService.logInfo("Database disconnected successfully");
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "Failed to disconnect from database",
      });
      throw error;
    }
  }

  isConnectedToDb(): boolean {
    return this.isConnected;
  }

  async checkHealth(): Promise<{ status: string; details?: any }> {
    try {
      if (!this.isConnected) {
        return {
          status: "disconnected",
          details: { message: "Database not connected" },
        };
      }

      // Test the connection with a simple query
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: "healthy",
        details: {
          database: "PostgreSQL",
          provider: "Prisma ORM",
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "Database health check failed",
      });
      return {
        status: "error",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  async ensureIndexes(): Promise<void> {
    // Prisma handles index creation via schema
    // This is a placeholder for compatibility
    loggerService.logInfo("Indexes are managed via Prisma schema", {
      context: "Database Indexes",
    });
  }

  // Get Prisma client instance for advanced operations
  getClient(): PrismaClient {
    return this.prisma;
  }

  // Execute transactions
  async executeTransaction<T>(
    callback: (prisma: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      return callback(tx as PrismaClient);
    });
  }
}

export const databaseService = DatabaseService.getInstance();
