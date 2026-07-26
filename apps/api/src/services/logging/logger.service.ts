import * as winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

// Definir niveles de log personalizados
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    transaction: 4,
    debug: 5,
  },
  colors: {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    transaction: "cyan",
    debug: "blue",
  },
};

// Formatear logs para incluir metadata completa
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    return JSON.stringify({
      timestamp,
      level,
      message,
      requestId: meta.requestId || "system",
      walletAddress: meta.walletAddress || null,
      transactionType: meta.transactionType || null,
      amount: meta.amount || null,
      signature: meta.signature || null,
      metadata: meta,
    });
  }),
);

// Crear transportes para diferentes tipos de logs
const createTransports = () => {
  const transports: winston.transport[] = [];

  // Console transport para desarrollo
  if (process.env.NODE_ENV !== "production") {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
        ),
      }),
    );
  }

  // Archivo para todos los logs
  transports.push(
    new DailyRotateFile({
      filename: path.join(__dirname, "../../../logs/prowallet-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "30d",
      format: logFormat,
    }),
  );

  // Archivo específico para transacciones
  transports.push(
    new DailyRotateFile({
      filename: path.join(__dirname, "../../../logs/transactions-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "100m",
      maxFiles: "90d",
      level: "transaction",
      format: logFormat,
    }),
  );

  // Archivo para errores críticos
  transports.push(
    new DailyRotateFile({
      filename: path.join(__dirname, "../../../logs/errors-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "50m",
      maxFiles: "60d",
      level: "error",
      format: logFormat,
    }),
  );

  return transports;
};

// Crear la instancia del logger
export const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || "debug",
  format: logFormat,
  transports: createTransports(),
  exitOnError: false,
});

// Añadir colores personalizados
winston.addColors(customLevels.colors);

// Interfaces para tipado fuerte
export interface TransactionLogData {
  requestId?: string;
  walletAddress: string;
  transactionType:
    | "purchase"
    | "transfer"
    | "claim"
    | "stake"
    | "unstake"
    | "admin";
  amount?: number;
  tokenMint?: string;
  signature?: string;
  status: "pending" | "success" | "failed";
  gasUsed?: number;
  blockSlot?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface MarketLogData {
  requestId?: string;
  event: "price_update" | "volume_update" | "supply_change" | "holder_change";
  oldValue?: number;
  newValue: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SecurityLogData {
  requestId?: string;
  event:
    | "auth_attempt"
    | "rate_limit_hit"
    | "suspicious_activity"
    | "admin_action"
    | "invalid_signature_format"
    | "transaction_not_found"
    | "failed_blockchain_transaction"
    | "wallet_not_in_transaction"
    | "no_balance_changes"
    | "solana_connectivity_error"
    | "manual_transaction_confirmation"
    | "manual_transaction_cancellation";
  severity: "low" | "medium" | "high" | "critical";
  userAgent?: string;
  ipAddress?: string;
  walletAddress?: string;
  details: string;
  metadata?: Record<string, any>;
}

// Clase principal del servicio de logging
export class LoggerService {
  private static instance: LoggerService;

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  // Generar ID único para seguimiento de requests
  generateRequestId(): string {
    return uuidv4();
  }

  // Log de transacciones con metadata completa
  logTransaction(data: TransactionLogData, message?: string): void {
    logger.log(
      "transaction",
      message || `Transaction ${data.transactionType}: ${data.status}`,
      {
        ...data,
        timestamp: new Date().toISOString(),
      },
    );
  }

  // Log de eventos de mercado
  logMarketEvent(data: MarketLogData, message?: string): void {
    logger.info(message || `Market event: ${data.event}`, {
      ...data,
      category: "market",
    });
  }

  // Log de eventos de seguridad
  logSecurity(data: SecurityLogData, message?: string): void {
    const level =
      data.severity === "critical" || data.severity === "high"
        ? "error"
        : "warn";
    logger.log(level, message || `Security event: ${data.event}`, {
      ...data,
      category: "security",
    });
  }

  // Log de API calls
  logApiCall(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    requestId: string,
    walletAddress?: string,
  ): void {
    logger.http(`${method} ${url} - ${statusCode} - ${responseTime}ms`, {
      requestId,
      method,
      url,
      statusCode,
      responseTime,
      walletAddress,
      category: "api",
    });
  }

  // Log de errores con stack trace
  logError(error: Error, context?: Record<string, any>): void {
    logger.error(error.message, {
      stack: error.stack,
      name: error.name,
      ...context,
      category: "error",
    });
  }

  // Log de información general
  logInfo(message: string, data?: Record<string, any>): void {
    logger.info(message, {
      ...data,
      category: "general",
    });
  }

  // Log de debug (solo en desarrollo)
  logDebug(message: string, data?: Record<string, any>): void {
    logger.debug(message, {
      ...data,
      category: "debug",
    });
  }

  // Log específico para compras de tokens (evento crítico)
  logTokenPurchase(data: {
    requestId: string;
    walletAddress: string;
    amount: number;
    tokenPrice: number;
    totalCost: number;
    paymentMethod: "SOL" | "USDC";
    signature?: string;
    status: "pending" | "success" | "failed";
    error?: string;
  }): void {
    this.logTransaction(
      {
        requestId: data.requestId,
        walletAddress: data.walletAddress,
        transactionType: "purchase",
        amount: data.amount,
        signature: data.signature,
        status: data.status,
        error: data.error,
        metadata: {
          tokenPrice: data.tokenPrice,
          totalCost: data.totalCost,
          paymentMethod: data.paymentMethod,
        },
      },
      `Token purchase: ${data.amount} PROWALLET for ${data.totalCost} ${data.paymentMethod}`,
    );
  }

  // Log para cambios de precio
  logPriceChange(
    oldPrice: number,
    newPrice: number,
    reason: string,
    requestId?: string,
  ): void {
    const changePercent = ((newPrice - oldPrice) / oldPrice) * 100;
    this.logMarketEvent(
      {
        requestId,
        event: "price_update",
        oldValue: oldPrice,
        newValue: newPrice,
        timestamp: new Date(),
        metadata: {
          changePercent: changePercent.toFixed(2),
          reason,
        },
      },
      `Price changed from ${oldPrice} to ${newPrice} (${changePercent > 0 ? "+" : ""}${changePercent.toFixed(2)}%): ${reason}`,
    );
  }

  // Log para cambios de supply
  logSupplyChange(
    oldSupply: number,
    newSupply: number,
    operation: string,
    requestId?: string,
  ): void {
    this.logMarketEvent(
      {
        requestId,
        event: "supply_change",
        oldValue: oldSupply,
        newValue: newSupply,
        timestamp: new Date(),
        metadata: {
          operation,
          change: newSupply - oldSupply,
        },
      },
      `Supply changed from ${oldSupply} to ${newSupply} via ${operation}`,
    );
  }

  // Log para nuevos holders
  logNewHolder(
    walletAddress: string,
    firstPurchaseAmount: number,
    requestId?: string,
  ): void {
    this.logMarketEvent(
      {
        requestId,
        event: "holder_change",
        newValue: firstPurchaseAmount,
        timestamp: new Date(),
        metadata: {
          walletAddress:
            walletAddress.slice(0, 8) + "..." + walletAddress.slice(-8), // Anonimizar
          action: "new_holder",
        },
      },
      `New holder joined with ${firstPurchaseAmount} PROWALLET`,
    );
  }

  // Alias para compatibilidad con el controlador
  logNewHolderEvent(
    walletAddress: string,
    firstPurchaseAmount: number,
    requestId?: string,
  ): void {
    this.logNewHolder(walletAddress, firstPurchaseAmount, requestId);
  }

  // Obtener estadísticas de logs para analytics
  async getTransactionStats(
    timeframe: "1h" | "24h" | "7d" | "30d" = "24h",
  ): Promise<{
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    totalVolume: number;
    averageTransactionSize: number;
  }> {
    // En una implementación real, esto consultaría los archivos de log o base de datos
    // Por ahora retornamos datos mock para la estructura
    return {
      totalTransactions: 156,
      successfulTransactions: 142,
      failedTransactions: 14,
      totalVolume: 45678.9,
      averageTransactionSize: 321.4,
    };
  }
}

// Export singleton instance
export const loggerService = LoggerService.getInstance();

// Middleware para Express que añade requestId a todas las requests
export const requestLoggerMiddleware = (req: any, res: any, next: any) => {
  const requestId = loggerService.generateRequestId();
  const startTime = Date.now();

  // Añadir requestId al request object
  req.requestId = requestId;

  // Log del inicio de la request
  loggerService.logApiCall(
    req.method,
    req.originalUrl,
    0, // statusCode no disponible aún
    0, // responseTime no disponible aún
    requestId,
    req.body?.walletAddress || req.params?.wallet,
  );

  // Override del res.json para capturar la respuesta
  const originalJson = res.json;
  res.json = function (data: any) {
    const responseTime = Date.now() - startTime;

    // Log de la respuesta completa
    loggerService.logApiCall(
      req.method,
      req.originalUrl,
      res.statusCode,
      responseTime,
      requestId,
      req.body?.walletAddress || req.params?.wallet || data?.data?.wallet,
    );

    return originalJson.call(this, data);
  };

  next();
};
