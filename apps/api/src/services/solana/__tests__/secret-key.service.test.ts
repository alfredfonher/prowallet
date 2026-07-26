import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as crypto from "crypto";
import {
  EnvironmentSecretStorage,
  AWSSecretsManagerStorage,
  VaultStorage,
  EncryptedFileStorage,
  SecretStorageFactory,
  SecretKeyService,
  secretKeyService,
} from "../secret-key.service";

// Mock console methods to avoid noise in tests
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

// Helper function to generate a valid hex private key
// Keypair secret keys are 64 bytes (256 hex characters)
function generateValidHexPrivateKey(): string {
  return crypto.randomBytes(64).toString("hex");
}

describe("SecretKeyService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();
    console.log = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
  });

  describe("EnvironmentSecretStorage", () => {
    let storage: EnvironmentSecretStorage;

    beforeEach(() => {
      storage = new EnvironmentSecretStorage();
    });

    describe("getPrivateKey", () => {
      it("should return private key when environment variable is set", async () => {
        const testKey = "test_private_key_123";
        process.env.TREASURY_PRIVATE_KEY = testKey;

        const result = await storage.getPrivateKey();
        expect(result).toBe(testKey);
      });

      it("should throw error when environment variable is not set", async () => {
        delete process.env.TREASURY_PRIVATE_KEY;
        delete process.env.AUTHORITY_KEYPAIR_PATH;

        await expect(storage.getPrivateKey()).rejects.toThrow(
          "TREASURY_PRIVATE_KEY environment variable not set and AUTHORITY_KEYPAIR_PATH not found",
        );
      });

      it("should throw error when environment variable is empty string", async () => {
        process.env.TREASURY_PRIVATE_KEY = "";
        delete process.env.AUTHORITY_KEYPAIR_PATH;

        await expect(storage.getPrivateKey()).rejects.toThrow(
          "TREASURY_PRIVATE_KEY environment variable not set and AUTHORITY_KEYPAIR_PATH not found",
        );
      });
    });

    describe("getPublicKey", () => {
      it("should return public key when environment variable is set", async () => {
        const testKey = "test_public_key_456";
        process.env.TREASURY_PUBLIC_KEY = testKey;

        const result = await storage.getPublicKey();
        expect(result).toBe(testKey);
      });

      it("should throw error when environment variable is not set", async () => {
        delete process.env.TREASURY_PUBLIC_KEY;

        await expect(storage.getPublicKey()).rejects.toThrow(
          "TREASURY_PUBLIC_KEY environment variable not set",
        );
      });
    });

    describe("getKeyPair", () => {
      it.skip("should create keypair from valid hex private key", async () => {
        // Generate a valid 32-byte hex private key
        const validHexKey = generateValidHexPrivateKey();
        process.env.TREASURY_PRIVATE_KEY = validHexKey;

        const result = await storage.getKeyPair();

        // Check that result has expected Keypair properties
        expect(result).toHaveProperty("publicKey");
        expect(result).toHaveProperty("secretKey");
        expect(typeof result.publicKey.toBase58).toBe("function");
        expect(typeof result.secretKey).toBe("object");

        // Verify the secret key can be converted to hex
        expect(result.secretKey.length).toBe(64);
      });

      it("should throw error for invalid private key format", async () => {
        process.env.TREASURY_PRIVATE_KEY = "invalid_key_format";

        await expect(storage.getKeyPair()).rejects.toThrow(
          "Invalid private key format",
        );
      });

      it("should throw error when private key environment variable is missing", async () => {
        delete process.env.TREASURY_PRIVATE_KEY;
        delete process.env.AUTHORITY_KEYPAIR_PATH;

        await expect(storage.getKeyPair()).rejects.toThrow(
          "TREASURY_PRIVATE_KEY environment variable not set and AUTHORITY_KEYPAIR_PATH not found",
        );
      });

      it("should handle empty private key", async () => {
        process.env.TREASURY_PRIVATE_KEY = "";
        delete process.env.AUTHORITY_KEYPAIR_PATH;

        await expect(storage.getKeyPair()).rejects.toThrow(
          "TREASURY_PRIVATE_KEY environment variable not set and AUTHORITY_KEYPAIR_PATH not found",
        );
      });
    });
  });

  describe("AWSSecretsManagerStorage", () => {
    let storage: AWSSecretsManagerStorage;

    beforeEach(() => {
      storage = new AWSSecretsManagerStorage();
    });

    it("should throw not implemented error for getPrivateKey", async () => {
      await expect(storage.getPrivateKey()).rejects.toThrow(
        "AWS Secrets Manager not implemented yet",
      );
    });

    it("should throw not implemented error for getPublicKey", async () => {
      await expect(storage.getPublicKey()).rejects.toThrow(
        "AWS Secrets Manager not implemented yet",
      );
    });

    it("should throw not implemented error for getKeyPair", async () => {
      await expect(storage.getKeyPair()).rejects.toThrow(
        "AWS Secrets Manager not implemented yet",
      );
    });
  });

  describe("VaultStorage", () => {
    let storage: VaultStorage;

    beforeEach(() => {
      storage = new VaultStorage();
    });

    it("should throw not implemented error for getPrivateKey", async () => {
      await expect(storage.getPrivateKey()).rejects.toThrow(
        "HashiCorp Vault not implemented yet",
      );
    });

    it("should throw not implemented error for getPublicKey", async () => {
      await expect(storage.getPublicKey()).rejects.toThrow(
        "HashiCorp Vault not implemented yet",
      );
    });

    it("should throw not implemented error for getKeyPair", async () => {
      await expect(storage.getKeyPair()).rejects.toThrow(
        "HashiCorp Vault not implemented yet",
      );
    });
  });

  describe("EncryptedFileStorage", () => {
    const testEncryptionKey = "a".repeat(64); // 32 bytes in hex
    let storage: EncryptedFileStorage;

    beforeEach(() => {
      storage = new EncryptedFileStorage(testEncryptionKey);
    });

    it("should throw not implemented error for getPrivateKey", async () => {
      await expect(storage.getPrivateKey()).rejects.toThrow(
        "Encrypted file storage not implemented yet",
      );
    });

    it("should throw not implemented error for getPublicKey", async () => {
      await expect(storage.getPublicKey()).rejects.toThrow(
        "Encrypted file storage not implemented yet",
      );
    });

    it("should throw not implemented error for getKeyPair", async () => {
      await expect(storage.getKeyPair()).rejects.toThrow(
        "Encrypted file storage not implemented yet",
      );
    });

    describe("encrypt/decrypt methods", () => {
      it("should encrypt and decrypt text correctly", () => {
        const plaintext = "secret_message_123";
        const encrypted = storage["encrypt"](plaintext);
        const decrypted = storage["decrypt"](encrypted);

        expect(encrypted).not.toBe(plaintext);
        expect(decrypted).toBe(plaintext);
      });

      it("should produce different encrypted values for same input", () => {
        const plaintext = "secret_message_123";
        const encrypted1 = storage["encrypt"](plaintext);
        const encrypted2 = storage["encrypt"](plaintext);

        expect(encrypted1).not.toBe(encrypted2);
      });

      it("should handle empty string encryption", () => {
        const plaintext = "";
        const encrypted = storage["encrypt"](plaintext);
        const decrypted = storage["decrypt"](encrypted);

        expect(decrypted).toBe(plaintext);
      });

      it("should handle unicode characters", () => {
        const plaintext = "🔐 secret with émojis ñ";
        const encrypted = storage["encrypt"](plaintext);
        const decrypted = storage["decrypt"](encrypted);

        expect(decrypted).toBe(plaintext);
      });
    });
  });

  describe("SecretStorageFactory", () => {
    it("should create EnvironmentSecretStorage for environment type", () => {
      const storage = SecretStorageFactory.create("environment");
      expect(storage).toBeInstanceOf(EnvironmentSecretStorage);
    });

    it("should create EnvironmentSecretStorage for uppercase type", () => {
      const storage = SecretStorageFactory.create("ENVIRONMENT");
      expect(storage).toBeInstanceOf(EnvironmentSecretStorage);
    });

    it("should create AWSSecretsManagerStorage for aws type", () => {
      const storage = SecretStorageFactory.create("aws");
      expect(storage).toBeInstanceOf(AWSSecretsManagerStorage);
    });

    it("should create VaultStorage for vault type", () => {
      const storage = SecretStorageFactory.create("vault");
      expect(storage).toBeInstanceOf(VaultStorage);
    });

    it("should create EncryptedFileStorage for encrypted type", () => {
      process.env.ENCRYPTION_KEY = "a".repeat(64);
      const storage = SecretStorageFactory.create("encrypted");
      expect(storage).toBeInstanceOf(EncryptedFileStorage);
      delete process.env.ENCRYPTION_KEY;
    });

    it("should throw error for encrypted type without encryption key", () => {
      delete process.env.ENCRYPTION_KEY;

      expect(() => SecretStorageFactory.create("encrypted")).toThrow(
        "ENCRYPTION_KEY environment variable not set for encrypted storage",
      );
    });

    it("should throw error for unknown storage type", () => {
      expect(() => SecretStorageFactory.create("unknown")).toThrow(
        "Unknown storage type: unknown",
      );
    });

    it("should default to environment when no type specified", () => {
      const storage = SecretStorageFactory.create();
      expect(storage).toBeInstanceOf(EnvironmentSecretStorage);
    });
  });

  describe("SecretKeyService", () => {
    let service: SecretKeyService;

    beforeEach(() => {
      // Clear environment variables
      delete process.env.SECRET_STORAGE_TYPE;
      delete process.env.TREASURY_PRIVATE_KEY;
      delete process.env.TREASURY_PUBLIC_KEY;
      delete process.env.AUTHORITY_KEYPAIR_PATH;
    });

    it("should use environment storage by default", () => {
      service = new SecretKeyService();
      expect(service).toBeDefined();
    });

    it("should use specified storage type", () => {
      service = new SecretKeyService("aws");
      expect(service).toBeDefined();
    });

    it("should use environment variable for storage type", () => {
      process.env.SECRET_STORAGE_TYPE = "vault";
      service = new SecretKeyService();
      expect(service).toBeDefined();
    });

    describe("with environment storage", () => {
      beforeEach(() => {
        service = new SecretKeyService("environment");
      });

      it("should get private key successfully", async () => {
        const testKey = "test_private_key_789";
        process.env.TREASURY_PRIVATE_KEY = testKey;

        const result = await service.getPrivateKey();
        expect(result).toBe(testKey);
      });

      it("should get public key successfully", async () => {
        const testKey = "test_public_key_abc";
        process.env.TREASURY_PUBLIC_KEY = testKey;

        const result = await service.getPublicKey();
        expect(result).toBe(testKey);
      });

      it.skip("should get keypair successfully", async () => {
        // Generate a valid 32-byte hex private key
        const validHexKey = generateValidHexPrivateKey();
        process.env.TREASURY_PRIVATE_KEY = validHexKey;

        const result = await service.getKeyPair();

        // Check that result has expected Keypair properties
        expect(result).toHaveProperty("publicKey");
        expect(result).toHaveProperty("secretKey");
        expect(typeof result.publicKey.toBase58).toBe("function");
        expect(typeof result.secretKey).toBe("object");

        // Verify the secret key is correct length
        expect(result.secretKey.length).toBe(64);
      });
    });
  });

  describe("secretKeyService singleton", () => {
    it("should export a singleton instance", () => {
      expect(secretKeyService).toBeInstanceOf(SecretKeyService);
    });

    it("should be the same instance across imports", async () => {
      const { secretKeyService: service1 } =
        await import("../secret-key.service");
      const { secretKeyService: service2 } =
        await import("../secret-key.service");
      expect(service1).toBe(service2);
    });
  });

  describe("Edge Cases", () => {
    let storage: EnvironmentSecretStorage;

    beforeEach(() => {
      storage = new EnvironmentSecretStorage();
    });

    it("should handle very long private keys", async () => {
      const longKey = "a".repeat(1000);
      process.env.TREASURY_PRIVATE_KEY = longKey;

      await expect(storage.getKeyPair()).rejects.toThrow(
        "Invalid private key format",
      );
    });

    it("should handle special characters in environment variables", async () => {
      const specialKey = "!@#$%^&*()_+-=[]{}|;:,.<>?";
      process.env.TREASURY_PRIVATE_KEY = specialKey;

      await expect(storage.getKeyPair()).rejects.toThrow(
        "Invalid private key format",
      );
    });

    it("should handle null-like values", async () => {
      process.env.TREASURY_PRIVATE_KEY = "null";
      process.env.TREASURY_PUBLIC_KEY = "undefined";

      const privateKey = await storage.getPrivateKey();
      const publicKey = await storage.getPublicKey();

      expect(privateKey).toBe("null");
      expect(publicKey).toBe("undefined");
    });

    it("should handle whitespace-only values", async () => {
      process.env.TREASURY_PRIVATE_KEY = "   ";
      process.env.TREASURY_PUBLIC_KEY = "\t\n";

      const privateKey = await storage.getPrivateKey();
      const publicKey = await storage.getPublicKey();

      expect(privateKey).toBe("   ");
      expect(publicKey).toBe("\t\n");
    });
  });
});
