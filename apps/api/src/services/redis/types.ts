/**
 * Tipos estrictos para el servicio Redis
 */

export interface RedisConfig {
  url: string;
  maxRetries: number;
  retryDelayMs: number;
  connectTimeoutMs: number;
  commandTimeoutMs: number;
  enableOfflineQueue: boolean;
  lazyConnect: boolean;
}

export interface RedisConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  lastError: string | null;
  connectAttempts: number;
  lastConnectedAt: number | null;
}

export interface RedisMetrics {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  averageLatency: number;
  connectionErrors: number;
  reconnections: number;
}

export interface CacheOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  latencyMs?: number;
}

// Error types
export class RedisServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly operation?: string,
  ) {
    super(message);
    this.name = "RedisServiceError";
  }
}

export class RedisConnectionError extends RedisServiceError {
  public readonly originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message, "CONNECTION_ERROR", "CONNECT");
    this.originalError = originalError;
  }
}

export class RedisCommandError extends RedisServiceError {
  constructor(message: string, command: string, key?: string) {
    super(message, "COMMAND_ERROR", command);
    this.command = command;
    this.key = key;
  }

  public readonly command: string;
  public readonly key?: string;
}

export class RedisValidationError extends RedisServiceError {
  constructor(message: string, field?: string) {
    super(message, "VALIDATION_ERROR");
    this.field = field;
  }

  public readonly field?: string;
}

export class RedisTimeoutError extends RedisServiceError {
  constructor(command: string, timeoutMs: number) {
    super(
      `Command ${command} timed out after ${timeoutMs}ms`,
      "TIMEOUT_ERROR",
      command,
    );
  }
}
