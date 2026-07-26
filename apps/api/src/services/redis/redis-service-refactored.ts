/**
 * Servicio Redis refactorizado
 * Aplicando principios SOLID, early returns y manejo robusto de errores
 */

import { createClient, RedisClientType } from "redis";
import {
  RedisConfig,
  RedisConnectionState,
  RedisMetrics,
  CacheOperationResult,
  RedisServiceError,
  RedisConnectionError,
  RedisCommandError,
  RedisValidationError,
  RedisTimeoutError,
} from "./types";
import {
  validateRedisKey,
  validateRedisValue,
  validateTtl,
  formatRedisKey,
  formatRedisValue,
  parseJsonSafely,
  createDelay,
  withTimeout,
  createRedisLogger,
  createErrorHandler,
  createRetryDelay,
  shouldRetry,
  calculateLatency,
  calculateAverage,
  createDefaultRedisConfig,
} from "./validators";

/**
 * Interfaz para inyección de dependencias (Dependency Inversion)
 */
export interface IRedisClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options?: { PX?: number },
  ): Promise<string | null>;
  isOpen: boolean;
}

/**
 * Wrapper del cliente Redis con manejo de errores
 */
export class RedisClientWrapper implements IRedisClient {
  private client: RedisClientType;
  private logger: ReturnType<typeof createRedisLogger>;
  private handleError: ReturnType<typeof createErrorHandler>;

  constructor(config: RedisConfig) {
    this.client = createClient({
      url: config.url,
      socket: {
        connectTimeout: config.connectTimeoutMs,
      },
    });

    this.logger = createRedisLogger();
    this.handleError = createErrorHandler(this.logger);
    this.setupEventHandlers();
  }

  get isOpen(): boolean {
    return this.client.isOpen;
  }

  async connect(): Promise<void> {
    try {
      if (this.client.isOpen) {
        this.logger.log("Redis already connected");
        return;
      }

      await this.client.connect();
      this.logger.log("Redis connected successfully");
    } catch (error) {
      const connectionError = new RedisConnectionError(
        `Failed to connect to Redis: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error : undefined,
      );
      this.logger.error("Redis connection failed", connectionError);
      throw connectionError;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (!this.client.isOpen) {
        this.logger.log("Redis already disconnected");
        return;
      }

      await this.client.quit();
      this.logger.log("Redis disconnected successfully");
    } catch (error) {
      this.logger.warn("Redis disconnect error", error);
      // No lanzar error en disconnect
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      validateRedisKey(key);
      return await this.client.get(key);
    } catch (error) {
      throw new RedisCommandError(
        `GET command failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "GET",
        key,
      );
    }
  }

  async set(
    key: string,
    value: string,
    options?: { PX?: number },
  ): Promise<string | null> {
    try {
      validateRedisKey(key);
      return await this.client.set(key, value, options);
    } catch (error) {
      throw new RedisCommandError(
        `SET command failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "SET",
        key,
      );
    }
  }

  private setupEventHandlers(): void {
    this.client.on("error", (err) => {
      this.logger.error("Redis client error", err);
    });

    this.client.on("connect", () => {
      this.logger.log("Redis client connected");
    });

    this.client.on("ready", () => {
      this.logger.log("Redis client ready");
    });

    this.client.on("end", () => {
      this.logger.log("Redis client connection ended");
    });

    this.client.on("reconnecting", () => {
      this.logger.log("Redis client reconnecting");
    });
  }

  // Exponer cliente original para compatibilidad
  getOriginalClient(): RedisClientType {
    return this.client;
  }
}

/**
 * Servicio Redis refactorizado
 * Principio: Single Responsibility
 */
export class RefactoredRedisService {
  private readonly config: RedisConfig;
  private readonly client: IRedisClient;
  private readonly logger: ReturnType<typeof createRedisLogger>;
  private readonly handleError: ReturnType<typeof createErrorHandler>;
  private readonly connectionState: RedisConnectionState;
  private readonly metrics: RedisMetrics;
  private latencyMeasurements: number[] = [];

  constructor(config?: Partial<RedisConfig>, client?: IRedisClient) {
    this.config = { ...createDefaultRedisConfig(), ...config };
    this.client = client || new RedisClientWrapper(this.config);
    this.logger = createRedisLogger();
    this.handleError = createErrorHandler(this.logger);
    this.connectionState = this.initializeConnectionState();
    this.metrics = this.initializeMetrics();
  }

  /**
   * Conectar a Redis con reintentos y early returns
   */
  async connect(): Promise<void> {
    if (this.connectionState.isConnected) {
      this.logger.log("Already connected to Redis");
      return;
    }

    if (this.connectionState.isConnecting) {
      this.logger.log("Connection already in progress");
      return;
    }

    this.connectionState.isConnecting = true;
    this.connectionState.connectAttempts++;

    try {
      await this.connectWithRetry();

      this.connectionState.isConnected = true;
      this.connectionState.isConnecting = false;
      this.connectionState.lastConnectedAt = Date.now();
      this.connectionState.lastError = null;

      this.logger.log(
        `Redis connected successfully after ${this.connectionState.connectAttempts} attempts`,
      );
    } catch (error) {
      this.connectionState.isConnecting = false;
      this.connectionState.lastError =
        error instanceof Error ? error.message : "Unknown error";

      this.logger.error("Failed to connect to Redis after all retries", error);
      throw error;
    }
  }

  /**
   * Desconectar de Redis
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();

      this.connectionState.isConnected = false;
      this.connectionState.isConnecting = false;
      this.connectionState.lastConnectedAt = null;

      this.logger.log("Redis disconnected successfully");
    } catch (error) {
      this.logger.warn("Error during Redis disconnect", error);
    }
  }

  /**
   * Obtener valor JSON con early returns y validación
   */
  async getJson(key: string): Promise<any> {
    const startTime = Date.now();

    try {
      // Early return para validación
      const validatedKey = validateRedisKey(key);

      // Early return si no está conectado
      if (!this.connectionState.isConnected) {
        throw new RedisConnectionError("Redis not connected");
      }

      // Ejecutar comando
      const value = await this.client.get(validatedKey);

      this.metrics.totalCommands++;

      if (!value) {
        this.logger.debug(`Key not found: ${validatedKey}`);
        return null;
      }

      // Parsear JSON de forma segura
      const parsedValue = parseJsonSafely(value);

      this.metrics.successfulCommands++;
      this.updateLatencyMetrics(calculateLatency(startTime));

      this.logger.debug(`JSON retrieved successfully: ${validatedKey}`);
      return parsedValue;
    } catch (error) {
      this.metrics.failedCommands++;
      throw this.handleError(error, `getJson(${key})`);
    }
  }

  /**
   * Guardar valor JSON con early returns y validación
   */
  async setJson(
    key: string,
    value: any,
    ttlMs?: number | null,
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      // Early returns para validación
      const validatedKey = validateRedisKey(key);
      const validatedValue = validateRedisValue(value);
      const validatedTtl = validateTtl(ttlMs);

      // Early return si no está conectado
      if (!this.connectionState.isConnected) {
        throw new RedisConnectionError("Redis not connected");
      }

      // Serializar valor
      const serializedValue = formatRedisValue(validatedValue);

      // Preparar opciones
      const options = validatedTtl ? { PX: validatedTtl } : undefined;

      // Ejecutar comando
      const result = await this.client.set(
        validatedKey,
        serializedValue,
        options,
      );

      this.metrics.totalCommands++;
      this.metrics.successfulCommands++;
      this.updateLatencyMetrics(calculateLatency(startTime));

      const success = result === "OK";

      this.logger.debug(
        `JSON stored successfully: ${validatedKey}, TTL: ${validatedTtl}ms`,
      );
      return success;
    } catch (error) {
      this.metrics.failedCommands++;
      throw this.handleError(error, `setJson(${key})`);
    }
  }

  /**
   * Obtener estado de conexión
   */
  getConnectionState(): RedisConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Obtener métricas
   */
  getMetrics(): RedisMetrics {
    return {
      ...this.metrics,
      averageLatency: calculateAverage(this.latencyMeasurements),
    };
  }

  /**
   * Verificar salud del servicio
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      const testKey = "health:check";

      await this.setJson(testKey, { timestamp: Date.now() }, 5000);
      await this.getJson(testKey);

      const latency = calculateLatency(startTime);

      return { healthy: true, latency };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Métodos privados con early returns

  private initializeConnectionState(): RedisConnectionState {
    return {
      isConnected: false,
      isConnecting: false,
      lastError: null,
      connectAttempts: 0,
      lastConnectedAt: null,
    };
  }

  private initializeMetrics(): RedisMetrics {
    return {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      averageLatency: 0,
      connectionErrors: 0,
      reconnections: 0,
    };
  }

  private async connectWithRetry(): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        await this.client.connect();
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");

        this.logger.warn(`Connection attempt ${attempt + 1} failed`, lastError);

        // Early return si no se debe reintentar
        if (!shouldRetry(lastError, attempt, this.config.maxRetries)) {
          break;
        }

        // Esperar antes del siguiente intento
        const delay = createRetryDelay(attempt, this.config.retryDelayMs);
        this.logger.debug(`Waiting ${delay}ms before retry...`);
        await createDelay(delay);
      }
    }

    throw new RedisConnectionError(
      `Failed to connect after ${this.config.maxRetries} attempts`,
      lastError || undefined,
    );
  }

  private updateLatencyMetrics(latency: number): void {
    this.latencyMeasurements.push(latency);

    // Mantener solo las últimas 100 mediciones
    if (this.latencyMeasurements.length > 100) {
      this.latencyMeasurements = this.latencyMeasurements.slice(-100);
    }
  }
}

// Export singleton instance para compatibilidad
export const refactoredRedisService = new RefactoredRedisService();

// Export funciones legacy para compatibilidad
export const connectRedis = () => refactoredRedisService.connect();
export const disconnectRedis = () => refactoredRedisService.disconnect();
export const getJson = (key: string) => refactoredRedisService.getJson(key);
export const setJson = (key: string, value: any, ttlMs?: number | null) =>
  refactoredRedisService.setJson(key, value, ttlMs);
