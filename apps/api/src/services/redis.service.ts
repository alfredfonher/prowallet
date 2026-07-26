import { createClient, RedisClientType } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export const redisClient: RedisClientType = createClient({ url: redisUrl });

redisClient.on("error", (err) => {
  console.error("Redis Client Error", err);
});

export async function connectRedis() {
  try {
    if (!redisClient.isOpen) await redisClient.connect();
    console.log("✅ Redis connected", redisUrl);
  } catch (err) {
    console.warn(
      "⚠️ Redis connection failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function disconnectRedis() {
  try {
    if (redisClient.isOpen) await redisClient.quit();
  } catch (err) {
    console.warn(
      "⚠️ Redis disconnect error:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function getJson(key: string) {
  try {
    const v = await redisClient.get(key);
    return v ? JSON.parse(v) : null;
  } catch (err) {
    console.warn(
      "Redis getJson error:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function setJson(
  key: string,
  value: any,
  ttlMs: number | null = null,
) {
  try {
    const s = JSON.stringify(value);
    if (ttlMs && ttlMs > 0) {
      await redisClient.set(key, s, { PX: ttlMs });
    } else {
      await redisClient.set(key, s);
    }
    return true;
  } catch (err) {
    console.warn(
      "Redis setJson error:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

export async function deleteKey(key: string) {
  try {
    await redisClient.del(key);
    return true;
  } catch (err) {
    console.warn(
      "Redis deleteKey error:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

export default redisClient;
