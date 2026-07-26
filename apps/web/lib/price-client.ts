export type PriceResult = {
  price: number;
  sources: { name: string; price: number }[];
  timestamp: number;
};

const DEFAULT_TTL_MS = 30 * 1000; // 30s
const STORAGE_KEY = "prowallet:price:SOL";

function nowMs() {
  return Date.now();
}

function tryParseNumber(v: any): number | null {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return null;
  return n;
}

async function fetchWithTimeout(url: string, timeoutMs = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(id);
  }
}

async function fetchCoinGecko(): Promise<number> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd`;
  const json = await fetchWithTimeout(url, 5000);
  const p = json?.solana?.usd;
  const n = tryParseNumber(p);
  if (n === null) throw new Error("Invalid CoinGecko response");
  return n;
}

async function fetchCoinCap(): Promise<number> {
  const url = `https://api.coincap.io/v2/assets/solana`;
  const json = await fetchWithTimeout(url, 5000);
  const p = json?.data?.priceUsd;
  const n = tryParseNumber(p);
  if (n === null) throw new Error("Invalid CoinCap response");
  return n;
}

async function fetchCryptoRank(): Promise<number> {
  // CryptoRank may not allow CORS from browser; keep as optional provider
  try {
    const url = `https://api.cryptorank.io/v1/coins/solana`;
    const json = await fetchWithTimeout(url, 5000);
    const p = json?.data?.price_usd || json?.data?.price;
    const n = tryParseNumber(p);
    if (n === null) throw new Error("Invalid CryptoRank response");
    return n;
  } catch (e) {
    throw new Error("CryptoRank unavailable or blocked by CORS");
  }
}

export async function getSolPriceFromClient(options?: {
  ttlMs?: number;
  providers?: Array<() => Promise<number>>;
}): Promise<PriceResult> {
  const ttl = options?.ttlMs ?? DEFAULT_TTL_MS;
  const providers = options?.providers ?? [
    () => fetchCoinGecko(),
    () => fetchCoinCap(),
    () => fetchCryptoRank(),
  ];

  // Check cache first
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PriceResult;
      if (
        parsed?.price &&
        parsed?.timestamp &&
        nowMs() - parsed.timestamp < ttl
      ) {
        return parsed;
      }
    }
  } catch (e) {
    // ignore cache read errors
  }

  // Fire providers in parallel
  const promises = providers.map((p) =>
    p().then(
      (price) => ({ ok: true as const, price }),
      (err) => ({ ok: false as const, err }),
    ),
  );
  const settled = await Promise.all(promises);

  const successes: { name: string; price: number }[] = [];
  if (settled[0] && (settled[0] as any).ok)
    successes.push({ name: "CoinGecko", price: (settled[0] as any).price });
  if (settled[1] && (settled[1] as any).ok)
    successes.push({ name: "CoinCap", price: (settled[1] as any).price });
  if (settled[2] && (settled[2] as any).ok)
    successes.push({
      name: "CryptoRank",
      price: (settled[2] as any).price,
    });

  if (successes.length === 0) {
    // fallback to cached value if present (even expired)
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PriceResult;
        if (parsed?.price) return parsed;
      }
    } catch (e) {
      // ignore
    }
    throw new Error("All providers failed and no cached price available");
  }

  // Choose the maximum price among successes
  const max = successes.reduce(
    (acc, cur) => (cur.price > acc.price ? cur : acc),
    successes[0],
  );

  const result: PriceResult = {
    price: max.price,
    sources: successes,
    timestamp: nowMs(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  } catch (e) {
    // ignore write errors
  }

  return result;
}
