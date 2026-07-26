import { Keypair } from "@solana/web3.js";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as bs58 from "bs58";

// Simple logger for now - replace with proper logger later
const logger = {
  error: (message: string, meta?: any) =>
    console.error(`[ERROR] ${message}`, meta || ""),
  info: (message: string, meta?: any) =>
    console.log(`[INFO] ${message}`, meta || ""),
  warn: (message: string, meta?: any) =>
    console.warn(`[WARN] ${message}`, meta || ""),
};

export interface SecretStorage {
  getPrivateKey(): Promise<string>;
  getPublicKey(): Promise<string>;
  getKeyPair(): Promise<Keypair>;
}

export class EnvironmentSecretStorage implements SecretStorage {
  async getPrivateKey(): Promise<string> {
    // Primero intentar desde variable de entorno
    const privateKey = process.env.TREASURY_PRIVATE_KEY;
    if (privateKey) {
      return privateKey;
    }

    // Si no existe, intentar cargar desde archivo AUTHORITY_KEYPAIR_PATH
    const keypairPath = process.env.AUTHORITY_KEYPAIR_PATH;
    if (keypairPath) {
      try {
        // Si la ruta contiene 'apps/api', es relativa a la raíz del proyecto
        // Si no, es relativa al directorio actual del API
        let fullPath: string;
        if (keypairPath.includes("apps/api")) {
          // Ruta relativa a raíz del proyecto
          fullPath = path.resolve(process.cwd(), "..", "..", keypairPath);
        } else {
          // Ruta relativa al directorio actual (asumiendo que estamos en apps/api)
          fullPath = path.resolve(process.cwd(), keypairPath);
        }

        logger.info("Attempting to load keypair", {
          originalPath: keypairPath,
          resolvedPath: fullPath,
        });

        const fileContent = fs.readFileSync(fullPath, "utf-8");
        const keypairArray = JSON.parse(fileContent);
        if (Array.isArray(keypairArray)) {
          logger.info("Successfully loaded keypair from file", {
            path: fullPath,
          });
          return Buffer.from(keypairArray).toString("hex");
        }
      } catch (e) {
        logger.warn("Failed to load keypair from file", {
          path: keypairPath,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    throw new Error(
      "TREASURY_PRIVATE_KEY environment variable not set and AUTHORITY_KEYPAIR_PATH not found",
    );
  }

  async getPublicKey(): Promise<string> {
    const publicKey = process.env.TREASURY_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error("TREASURY_PUBLIC_KEY environment variable not set");
    }
    return publicKey;
  }

  async getKeyPair(): Promise<Keypair> {
    const privateKey = await this.getPrivateKey();
    try {
      const secretKey = this.parsePrivateKey(privateKey);
      return Keypair.fromSecretKey(secretKey);
    } catch (error) {
      logger.error("Failed to create keypair from private key", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error("Invalid private key format");
    }
  }

  private parsePrivateKey(privateKey: string): Buffer {
    // Try hex format first (test generates hex format)
    try {
      return Buffer.from(privateKey, "hex");
    } catch {
      // If hex fails, try base58 format
      try {
        const decoded = bs58.decode(privateKey);
        return Buffer.from(decoded);
      } catch {
        throw new Error("Private key must be hex or base58 format");
      }
    }
  }
}

export class AWSSecretsManagerStorage implements SecretStorage {
  async getPrivateKey(): Promise<string> {
    throw new Error("AWS Secrets Manager not implemented yet");
  }

  async getPublicKey(): Promise<string> {
    throw new Error("AWS Secrets Manager not implemented yet");
  }

  async getKeyPair(): Promise<Keypair> {
    throw new Error("AWS Secrets Manager not implemented yet");
  }
}

export class VaultStorage implements SecretStorage {
  async getPrivateKey(): Promise<string> {
    throw new Error("HashiCorp Vault not implemented yet");
  }

  async getPublicKey(): Promise<string> {
    throw new Error("HashiCorp Vault not implemented yet");
  }

  async getKeyPair(): Promise<Keypair> {
    throw new Error("HashiCorp Vault not implemented yet");
  }
}

export class EncryptedFileStorage implements SecretStorage {
  private readonly encryptionKey: string;

  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey;
  }

  async getPrivateKey(): Promise<string> {
    throw new Error("Encrypted file storage not implemented yet");
  }

  async getPublicKey(): Promise<string> {
    throw new Error("Encrypted file storage not implemented yet");
  }

  async getKeyPair(): Promise<Keypair> {
    throw new Error("Encrypted file storage not implemented yet");
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      Buffer.from(this.encryptionKey, "hex"),
      iv,
    );
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const textParts = encryptedText.split(":");
    const iv = Buffer.from(textParts.shift()!, "hex");
    const encryptedTextPart = textParts.join(":");
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(this.encryptionKey, "hex"),
      iv,
    );
    let decrypted = decipher.update(encryptedTextPart, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }
}

export class SecretStorageFactory {
  static create(storageType: string = "environment"): SecretStorage {
    switch (storageType.toLowerCase()) {
      case "environment":
        return new EnvironmentSecretStorage();
      case "aws":
        return new AWSSecretsManagerStorage();
      case "vault":
        return new VaultStorage();
      case "encrypted":
        const encryptionKey = process.env.ENCRYPTION_KEY;
        if (!encryptionKey) {
          throw new Error(
            "ENCRYPTION_KEY environment variable not set for encrypted storage",
          );
        }
        return new EncryptedFileStorage(encryptionKey);
      default:
        throw new Error(`Unknown storage type: ${storageType}`);
    }
  }
}

export class SecretKeyService {
  private readonly storage: SecretStorage;

  constructor(storageType?: string) {
    const type =
      storageType || process.env.SECRET_STORAGE_TYPE || "environment";
    this.storage = SecretStorageFactory.create(type);
  }

  async getPrivateKey(): Promise<string> {
    return this.storage.getPrivateKey();
  }

  async getPublicKey(): Promise<string> {
    return this.storage.getPublicKey();
  }

  async getKeyPair(): Promise<Keypair> {
    return this.storage.getKeyPair();
  }
}

export const secretKeyService = new SecretKeyService();
