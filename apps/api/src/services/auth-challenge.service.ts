import * as crypto from "crypto";
import { redisClient, getJson, setJson, deleteKey } from "./redis.service";

type ChallengeEntry = {
  nonce: string;
  message: string;
  expiresAt: number;
};

class AuthChallengeService {
  private memoryStore: Map<string, ChallengeEntry> = new Map();
  private ttlMinutes: number;

  constructor(ttlMinutes = 5) {
    this.ttlMinutes = ttlMinutes;
  }

  private getChallengeKey(publicKey: string): string {
    return `auth:challenge:${publicKey}`;
  }

  async createChallenge(publicKey: string) {
    const nonce = crypto.randomBytes(16).toString("hex");
    const expiresAt = Date.now() + this.ttlMinutes * 60 * 1000;

    // Construct a human-readable challenge message to sign
    const message = `Sign this message to authenticate with ProWallet:\nnonce:${nonce}`;

    const entry: ChallengeEntry = { nonce, message, expiresAt };

    // Store in memory (primary) AND Redis (backup/distributed)
    this.memoryStore.set(publicKey, entry);

    // Try Redis but don't fail if it doesn't work
    try {
      const key = this.getChallengeKey(publicKey);
      await setJson(key, entry, this.ttlMinutes * 60);
    } catch (err) {
      console.warn("[CHALLENGE] Redis storage failed, using memory:", err);
    }

    return { nonce, message, expiresAt };
  }

  async verifyAndConsume(
    publicKey: string,
    provided: { message?: string; nonce?: string },
  ) {
    const key = this.getChallengeKey(publicKey);

    try {
      // Try memory first (fastest)
      let entry = this.memoryStore.get(publicKey);

      // If not in memory, try Redis
      if (!entry) {
        const redisEntry = (await getJson(key)) as ChallengeEntry | null;
        if (redisEntry) {
          entry = redisEntry;
        }
      }

      console.log("[CHALLENGE] verifyAndConsume:", {
        publicKey: publicKey.substring(0, 8) + "...",
        entryExists: !!entry,
        fromMemory: this.memoryStore.has(publicKey),
      });

      if (!entry) {
        console.log("[CHALLENGE] no_challenge - entry not found");
        return { ok: false, reason: "no_challenge" };
      }

      if (Date.now() > entry.expiresAt) {
        console.log("[CHALLENGE] expired - TTL exceeded");
        return { ok: false, reason: "expired" };
      }

      // If nonce provided, compare
      if (provided.nonce) {
        if (provided.nonce !== entry.nonce) {
          console.log("[CHALLENGE] nonce_mismatch");
          return { ok: false, reason: "nonce_mismatch" };
        }
      }

      // If message provided, ensure it contains the expected nonce and equals stored message
      if (provided.message) {
        if (!provided.message.includes(entry.nonce)) {
          console.log("[CHALLENGE] message does not include nonce");
          return { ok: false, reason: "nonce_mismatch" };
        }
        if (provided.message !== entry.message) {
          console.log("[CHALLENGE] message_mismatch", {
            providedLength: provided.message.length,
            storedLength: entry.message.length,
          });
          return { ok: false, reason: "message_mismatch" };
        }
      }

      console.log("[CHALLENGE] verified successfully (NOT consumed yet)");
      return { ok: true, message: entry.message };
    } catch (error) {
      console.error("[CHALLENGE] Error verifying challenge:", error);
      return { ok: false, reason: "verification_error" };
    }
  }

  async consume(publicKey: string): Promise<void> {
    console.log(`[CHALLENGE] consuming challenge for ${publicKey}`);
    this.memoryStore.delete(publicKey);
    try {
      await deleteKey(this.getChallengeKey(publicKey));
    } catch (err) {
      console.warn("[CHALLENGE] Error deleting from Redis:", err);
    }
  }
}

export const authChallengeService = new AuthChallengeService();
